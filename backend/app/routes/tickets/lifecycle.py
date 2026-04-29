from __future__ import annotations

from flask import jsonify, request
from sqlalchemy.exc import IntegrityError

from app.auth import login_required
from app.models import MealRecord, Student, Ticket, db
from app.routes.tickets import tickets_bp
from app.routes.tickets.shared import (
    apply_ticket_scope,
    ensure_ticket_access,
    resolve_optional_building_id,
    resolve_ticket_creation_period,
    resolve_ticket_creation_period_payload,
)
from app.serializer_state import serialize_ticket_item, serialize_tickets
from app.services.ticket_bulk_issue import (
    BulkIssueStudentSelection,
    build_active_ticket_exists_message,
    create_bulk_tickets_from_preview,
    load_bulk_issue_students,
    preview_bulk_ticket_issue,
    resolve_requested_student_ids,
)
from app.services.ticket_integrity import find_active_ticket
from app.services.ticket_lifecycle import build_ticket, reissue_ticket, resolve_ticket_end_date_change
from app.services.ticket_statuses import sync_ticket_statuses
from app.utils.audit import log_action
from app.utils.student_access import assigned_to_meal_building_expr, has_student_management_access
from app.utils.validators import validate_not_past_month


def _build_ticket_conflict_error(message: str):
    return jsonify({"error": message}), 409


def _handle_active_ticket_integrity_conflict(
    student_id: str,
    month: int,
    year: int,
    *,
    exclude_ticket_id: str | None = None,
):
    conflict = find_active_ticket(student_id, month, year, exclude_ticket_id=exclude_ticket_id)
    if conflict:
        return _build_ticket_conflict_error(build_active_ticket_exists_message(f"{month:02d}.{year}"))
    return _build_ticket_conflict_error("Конфликт данных талона")


@tickets_bp.get("")
@login_required(roles=["social", "head_social", "cashier", "accountant", "admin"])
def list_tickets(current_user):
    sync_ticket_statuses()
    building_id = request.args.get("building_id", type=int)
    student_id = request.args.get("student_id")
    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)
    status = request.args.get("status")
    category_id = request.args.get("category_id", type=int)
    attention_only = request.args.get("attention_only", type=int) == 1

    query = Ticket.query.join(Student)
    query = apply_ticket_scope(query, current_user, building_id)
    if student_id:
        query = query.filter(Ticket.student_id == student_id)
    if month:
        query = query.filter(Ticket.month == month)
    if year:
        query = query.filter(Ticket.year == year)
    if status:
        query = query.filter(Ticket.status == status)
    if category_id:
        query = query.filter(Ticket.category_id == category_id)

    tickets = query.order_by(Ticket.created_at.desc()).all()
    serialized = serialize_tickets(tickets)
    if attention_only:
        serialized = [ticket for ticket in serialized if ticket["requires_attention"]]
    return jsonify({"data": serialized})


@tickets_bp.get("/<ticket_id>")
@login_required(roles=["social", "head_social", "cashier", "accountant", "admin"])
def get_ticket(current_user, ticket_id):
    sync_ticket_statuses()
    ticket = Ticket.query.filter_by(id=ticket_id).first_or_404()
    access_error = ensure_ticket_access(current_user, ticket)
    if access_error:
        return access_error
    return jsonify({"data": serialize_ticket_item(ticket)})


@tickets_bp.post("")
@login_required(roles=["social", "head_social", "admin"])
def create_ticket(current_user):
    sync_ticket_statuses()
    payload = request.get_json(silent=True) or {}
    student_id = payload.get("student_id")
    if not student_id:
        return jsonify({"error": "student_id обязателен"}), 400

    period, error_response, status_code = resolve_ticket_creation_period(payload.get("month"), payload.get("year"))
    if error_response:
        return error_response, status_code
    start_date, end_date = period
    past_month_error = validate_not_past_month(start_date.month, start_date.year)
    if past_month_error:
        return jsonify({"error": past_month_error[0]}), past_month_error[1]

    student = Student.query.filter_by(id=student_id, is_active=True).first()
    if not student:
        return jsonify({"error": "Студент не найден"}), 404

    if not has_student_management_access(current_user, student):
        return jsonify({"error": "Доступ к студенту запрещен"}), 403

    existing = find_active_ticket(student.id, start_date.month, start_date.year)
    if existing:
        return jsonify({"error": build_active_ticket_exists_message(f"{start_date.month:02d}.{start_date.year}")}), 409

    try:
        ticket = build_ticket(student, current_user.id, start_date, end_date)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _handle_active_ticket_integrity_conflict(student.id, start_date.month, start_date.year)

    log_action(
        current_user,
        "create_ticket",
        "ticket",
        ticket.id,
        {"student_id": student.id, "month": ticket.month, "year": ticket.year},
    )
    return jsonify({"data": serialize_ticket_item(ticket), "message": "Талон создан"}), 201


@tickets_bp.post("/bulk/preview")
@login_required(roles=["social", "head_social", "admin"])
def preview_tickets_bulk(current_user):
    sync_ticket_statuses()
    payload = request.get_json(silent=True) or {}
    period, error_response, status_code = resolve_ticket_creation_period_payload(payload)
    if error_response:
        return error_response, status_code
    start_date, end_date = period
    past_month_error = validate_not_past_month(start_date.month, start_date.year)
    if past_month_error:
        return jsonify({"error": past_month_error[0]}), past_month_error[1]

    building_id, access_error = resolve_optional_building_id(
        current_user,
        payload.get("building_id", current_user.building_id),
    )
    if access_error:
        return access_error

    category_id = payload.get("category_id")
    only_active = payload.get("only_active", True)
    requested_student_ids, validation_error = resolve_requested_student_ids(payload.get("student_ids"))
    if validation_error:
        return jsonify({"error": validation_error}), 400

    selection = load_bulk_issue_students(
        current_user,
        building_id=building_id,
        category_id=int(category_id) if category_id else None,
        only_active=only_active,
        requested_student_ids=requested_student_ids,
    )
    preview = preview_bulk_ticket_issue(selection, start_date=start_date, end_date=end_date)
    return jsonify({"data": preview.serialize(), "message": "Предпросмотр пакетной выдачи готов"})


@tickets_bp.post("/bulk")
@login_required(roles=["social", "head_social", "admin"])
def create_tickets_bulk(current_user):
    sync_ticket_statuses()
    payload = request.get_json(silent=True) or {}
    period, error_response, status_code = resolve_ticket_creation_period_payload(payload)
    if error_response:
        return error_response, status_code
    start_date, end_date = period
    past_month_error = validate_not_past_month(start_date.month, start_date.year)
    if past_month_error:
        return jsonify({"error": past_month_error[0]}), past_month_error[1]

    building_id, access_error = resolve_optional_building_id(
        current_user,
        payload.get("building_id", current_user.building_id),
    )
    if access_error:
        return access_error

    category_id = payload.get("category_id")
    only_active = payload.get("only_active", True)
    requested_student_ids, validation_error = resolve_requested_student_ids(payload.get("student_ids"))
    if validation_error:
        return jsonify({"error": validation_error}), 400

    selection = load_bulk_issue_students(
        current_user,
        building_id=building_id,
        category_id=int(category_id) if category_id else None,
        only_active=only_active,
        requested_student_ids=requested_student_ids,
    )
    preview = preview_bulk_ticket_issue(selection, start_date=start_date, end_date=end_date)
    created, skipped_students, created_student_count = create_bulk_tickets_from_preview(preview, current_user)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _build_ticket_conflict_error("Конфликт при пакетном создании талонов")

    for ticket in created:
        log_action(
            current_user,
            "create_ticket_bulk_item",
            "ticket",
            ticket.id,
            {"student_id": ticket.student_id, "month": ticket.month, "year": ticket.year},
        )

    log_action(
        current_user,
        "create_ticket_bulk",
        "ticket_batch",
        None,
        {
            "building_id": building_id,
            "category_id": int(category_id) if category_id else None,
            "student_ids": requested_student_ids or None,
            "created_count": len(created),
            "created_student_count": created_student_count,
            "skipped_count": len(skipped_students),
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "period_segments_count": len(preview.segments),
        },
    )

    return jsonify(
        {
            "data": {
                "created_count": len(created),
                "created_student_count": created_student_count,
                "skipped_count": len(skipped_students),
                "created": serialize_tickets(created),
                "skipped_students": skipped_students,
                "period_start": start_date.isoformat(),
                "period_end": end_date.isoformat(),
            },
            "message": "Пакетная выдача талонов завершена",
        }
    )


@tickets_bp.post("/bulk-from-previous")
@login_required(roles=["social", "head_social", "admin"])
def clone_tickets_from_previous(current_user):
    sync_ticket_statuses()
    payload = request.get_json(silent=True) or {}
    period, error_response, status_code = resolve_ticket_creation_period(
        payload.get("target_month"),
        payload.get("target_year"),
    )
    if error_response:
        return error_response, status_code
    start_date, end_date = period
    past_month_error = validate_not_past_month(start_date.month, start_date.year)
    if past_month_error:
        return jsonify({"error": past_month_error[0]}), past_month_error[1]

    source_month = payload.get("source_month")
    source_year = payload.get("source_year")
    if not source_month or not source_year:
        return jsonify({"error": "Нужны source_month и source_year"}), 400

    building_id, access_error = resolve_optional_building_id(
        current_user,
        payload.get("building_id", current_user.building_id),
    )
    if access_error:
        return access_error

    category_id = payload.get("category_id")

    source_query = Student.query.join(Ticket).filter(
        Ticket.month == int(source_month),
        Ticket.year == int(source_year),
    )
    if current_user.role == "social":
        source_query = source_query.filter(Student.building_id == current_user.building_id)
    elif building_id:
        source_query = source_query.filter(assigned_to_meal_building_expr(building_id))
    if category_id:
        source_query = source_query.filter(Student.category_id == int(category_id))

    source_students = source_query.order_by(Student.full_name.asc()).all()
    seen_student_ids = set()
    students: list[Student] = []
    for student in source_students:
        if student.id in seen_student_ids:
            continue
        seen_student_ids.add(student.id)
        students.append(student)

    selection = BulkIssueStudentSelection(
        requested_student_ids=None,
        students=students,
        skipped_students=[],
        selected_student_count=len(students),
        inactive_count=0,
        unavailable_count=0,
    )
    preview = preview_bulk_ticket_issue(selection, start_date=start_date, end_date=end_date)
    created, skipped_students, created_student_count = create_bulk_tickets_from_preview(preview, current_user)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _build_ticket_conflict_error("Конфликт при переносе талонов")

    for ticket in created:
        log_action(
            current_user,
            "clone_ticket_from_previous_item",
            "ticket",
            ticket.id,
            {"student_id": ticket.student_id, "month": ticket.month, "year": ticket.year},
        )

    log_action(
        current_user,
        "clone_ticket_from_previous",
        "ticket_batch",
        None,
        {
            "source_month": int(source_month),
            "source_year": int(source_year),
            "target_month": start_date.month,
            "target_year": start_date.year,
            "building_id": building_id,
            "category_id": int(category_id) if category_id else None,
            "created_count": len(created),
            "created_student_count": created_student_count,
            "skipped_count": len(skipped_students),
        },
    )

    return jsonify(
        {
            "data": {
                "created_count": len(created),
                "created_student_count": created_student_count,
                "skipped_count": len(skipped_students),
                "created": serialize_tickets(created),
                "skipped_students": skipped_students,
            },
            "message": "Талоны перенесены из прошлого месяца",
        }
    )


@tickets_bp.post("/<ticket_id>/reissue")
@login_required(roles=["social", "head_social", "admin"])
def reissue_existing_ticket(current_user, ticket_id):
    sync_ticket_statuses()
    ticket = Ticket.query.filter_by(id=ticket_id).first_or_404()
    access_error = ensure_ticket_access(current_user, ticket)
    if access_error:
        return access_error
    if ticket.status == "cancelled":
        return jsonify({"error": "Отмененный талон нельзя перевыпустить"}), 409

    existing = find_active_ticket(ticket.student_id, ticket.month, ticket.year, exclude_ticket_id=ticket.id)
    if existing:
        return _build_ticket_conflict_error(build_active_ticket_exists_message(f"{ticket.month:02d}.{ticket.year}"))

    try:
        replacement = reissue_ticket(ticket, current_user.id)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _handle_active_ticket_integrity_conflict(
            ticket.student_id,
            ticket.month,
            ticket.year,
            exclude_ticket_id=ticket.id,
        )

    log_action(
        current_user,
        "reissue_ticket",
        "ticket",
        replacement.id,
        {
            "previous_ticket_id": ticket.id,
            "student_id": replacement.student_id,
            "month": replacement.month,
            "year": replacement.year,
        },
    )
    return jsonify({"data": serialize_ticket_item(replacement), "message": "Талон перевыпущен"}), 201


@tickets_bp.patch("/<ticket_id>")
@login_required(roles=["social", "head_social", "admin"])
def update_ticket(current_user, ticket_id):
    sync_ticket_statuses()
    ticket = Ticket.query.filter_by(id=ticket_id).first_or_404()
    access_error = ensure_ticket_access(current_user, ticket)
    if access_error:
        return access_error

    payload = request.get_json(silent=True) or {}
    if "end_date" in payload:
        if any(field in payload for field in {"start_date", "month", "year"}):
            return jsonify({"error": "Можно менять только конечную дату действия талона"}), 400
        if "status" in payload:
            return jsonify({"error": "Изменение срока действия и смена статуса выполняются отдельно"}), 400

        result, error_message, status_code = resolve_ticket_end_date_change(ticket, payload.get("end_date"))
        if error_message:
            return jsonify({"error": error_message}), status_code

        assert result is not None
        if result.next_status == "active" and result.previous_status != "active":
            existing = find_active_ticket(ticket.student_id, ticket.month, ticket.year, exclude_ticket_id=ticket.id)
            if existing:
                return jsonify({"error": build_active_ticket_exists_message(f"{ticket.month:02d}.{ticket.year}")}), 409

        ticket.end_date = result.next_end_date
        ticket.status = result.next_status
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return _handle_active_ticket_integrity_conflict(
                ticket.student_id,
                ticket.month,
                ticket.year,
                exclude_ticket_id=ticket.id,
            )

        log_action(
            current_user,
            "update_ticket_end_date",
            "ticket",
            ticket.id,
            {
                "previous_end_date": result.previous_end_date.isoformat(),
                "end_date": ticket.end_date.isoformat(),
                "previous_status": result.previous_status,
                "status": ticket.status,
                "month": ticket.month,
                "year": ticket.year,
            },
        )
        return jsonify({"data": serialize_ticket_item(ticket), "message": "Срок действия талона обновлен"})

    if any(field in payload for field in {"start_date", "month", "year"}):
        return jsonify({"error": "Период талона задается автоматически по выбранному месяцу и не редактируется вручную"}), 400

    next_status = payload.get("status", ticket.status)
    if next_status not in {"active", "used", "expired", "cancelled"}:
        return jsonify({"error": "Некорректный статус талона"}), 400

    if next_status == "active":
        existing = find_active_ticket(ticket.student_id, ticket.month, ticket.year, exclude_ticket_id=ticket.id)
        if existing:
            return jsonify({"error": build_active_ticket_exists_message(f"{ticket.month:02d}.{ticket.year}")}), 409

    has_meals = MealRecord.query.filter_by(ticket_id=ticket.id).first() is not None
    is_reactivating = ticket.status != next_status and next_status == "active"
    is_cancelling = ticket.status != next_status and next_status == "cancelled"
    if has_meals and (is_reactivating or is_cancelling):
        return jsonify({"error": "Нельзя отменять или повторно активировать талон, по которому уже есть выдача питания"}), 409

    ticket.status = next_status
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _handle_active_ticket_integrity_conflict(
            ticket.student_id,
            ticket.month,
            ticket.year,
            exclude_ticket_id=ticket.id,
        )

    log_action(
        current_user,
        "update_ticket",
        "ticket",
        ticket.id,
        {"status": ticket.status, "month": ticket.month, "year": ticket.year},
    )
    return jsonify({"data": serialize_ticket_item(ticket), "message": "Талон обновлен"})
