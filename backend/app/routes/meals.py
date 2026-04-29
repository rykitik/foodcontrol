from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from io import BytesIO

from flask import Blueprint, current_app, jsonify, request, send_file
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.auth import login_required
from app.models import MealRecord, Student, Ticket, db
from app.serializer_state import (
    serialize_meal_record_item,
    serialize_meal_records,
    serialize_student_item,
)
from app.services.cashier_offline_snapshot import build_cashier_offline_snapshot
from app.services.cashier_offline_sync import run_offline_sync_batch, summarize_sync_results
from app.services.cashier_journal import build_cashier_journal
from app.services.cashier_summary import build_cashier_daily_summary
from app.services.cashier_summary_workbook import build_cashier_summary_workbook_bytes
from app.services.meal_confirmation import confirm_meal_selection_request
from app.services.meals import (
    aggregate_meal_report,
    build_day_statuses,
    can_issue_meals_to_student,
    get_service_day_context,
    parse_iso_date,
    resolve_meal_hint_from_code,
    resolve_payload_meal_hint,
    resolve_serving_building_id,
    resolve_issue_context,
    resolve_ticket_by_payload,
)
from app.utils.audit import log_action
from app.utils.meal_rules import SUPPORTED_MEAL_TYPES, meal_price_for_category
from app.utils.student_access import (
    available_for_cashier_building_expr,
    build_student_access_error_message,
    has_student_access,
)

meals_bp = Blueprint("meals", __name__)


def validate_issue_context(current_user, payload: dict):
    ticket, student, issue_date, error_message, status_code = resolve_issue_context(
        payload, current_app.config.get("MEAL_HOLIDAYS")
    )
    if error_message:
        return None, None, None, jsonify({"error": error_message}), status_code

    if not has_student_access(current_user, student):
        return (
            None,
            None,
            None,
            (jsonify({"error": build_student_access_error_message(current_user, student)}), 403),
            None,
        )

    return ticket, student, issue_date, None, None


def build_meal_record_conflict_response(message: str, data: dict | None = None):
    payload = {"error": message}
    if data is not None:
        payload["data"] = data
    return jsonify(payload), 409


def find_meal_record_duplicate(ticket_id: str, issue_date: date, meal_type: str):
    return MealRecord.query.filter_by(ticket_id=ticket_id, issue_date=issue_date, meal_type=meal_type).first()


def list_issue_meal_records(ticket_id: str, issue_date: date, meal_types: list[str] | None = None):
    query = MealRecord.query.filter_by(ticket_id=ticket_id, issue_date=issue_date)
    if meal_types:
        query = query.filter(MealRecord.meal_type.in_(meal_types))
    return query.order_by(MealRecord.issue_time.asc()).all()


def build_record_all_conflict_payload(records: list[MealRecord]):
    return {
        "records": serialize_meal_records(records),
        "issued_meals": [],
        "already_issued_meals": [record.meal_type for record in records],
        "total_amount": round(sum(float(record.price or 0) for record in records), 2),
    }


def resolve_cashier_summary_request(current_user) -> tuple[int, int | None, int | None, int | None]:
    days = max(1, min(request.args.get("days", default=5, type=int) or 5, 31))
    building_id = request.args.get("building_id", type=int) or current_user.building_id
    if current_user.role == "cashier":
        building_id = current_user.building_id

    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)
    return days, building_id, month, year


def process_offline_sync_item(current_user, payload: dict):
    result = confirm_meal_selection_request(
        current_user,
        payload,
        configured_holidays=current_app.config.get("MEAL_HOLIDAYS"),
    )
    return result.http_status, result.response_body


def resolve_cashier_journal_request(current_user) -> tuple[date, int | None]:
    journal_date_raw = request.args.get("date")
    if journal_date_raw:
        journal_date, date_error = parse_iso_date(journal_date_raw, "date")
        if date_error:
            raise ValueError(date_error)
    else:
        journal_date = date.today()

    building_id = request.args.get("building_id", type=int) or current_user.building_id
    if current_user.role == "cashier":
        building_id = current_user.building_id

    return journal_date, building_id


def resolve_today_stats_building_id(current_user) -> int | None:
    requested_building_id = request.args.get("building_id", type=int)
    if current_user.role == "cashier":
        return current_user.building_id

    return requested_building_id


@meals_bp.get("/resolve")
@login_required(roles=["cashier", "head_social", "admin"])
def resolve_lookup(current_user):
    query = (request.args.get("query") or "").strip()
    if not query:
        return jsonify({"error": "Нужен query"}), 400

    is_service_day, blocked_reason = get_service_day_context(date.today(), current_app.config.get("MEAL_HOLIDAYS"))
    scan_meal_hint = resolve_meal_hint_from_code(query)
    ticket = resolve_ticket_by_payload(query)
    student = None
    active_ticket = None

    if ticket:
        student = ticket.student
        if ticket.status == "active":
            active_ticket = ticket
    else:
        student = (
            Student.query.filter(
                (Student.student_card == query)
                | (Student.id == query)
                | (Student.full_name.ilike(f"%{query}%"))
            )
            .order_by(Student.full_name.asc())
            .first()
        )
        if student:
            ticket = (
                Ticket.query.filter_by(student_id=student.id, status="active")
                .order_by(Ticket.created_at.desc())
                .first()
            )
            active_ticket = ticket

    if student:
        if not has_student_access(current_user, student):
            return jsonify({"error": build_student_access_error_message(current_user, student)}), 403

    recent_meals = []
    today_meals = []
    today_statuses = []
    remaining_meals = []
    issued_today_amount = 0.0
    allowed_meals = []

    if student:
        recent_meals = (
            MealRecord.query.filter_by(student_id=student.id)
            .order_by(MealRecord.issue_date.desc(), MealRecord.issue_time.desc())
            .limit(5)
            .all()
        )
        today_meals, today_statuses, remaining_meals, issued_today_amount = build_day_statuses(
            student,
            active_ticket,
            date.today(),
        )
        if can_issue_meals_to_student(student):
            allowed_meals = list(student.category.meal_types)
        else:
            remaining_meals = []

        if allowed_meals and scan_meal_hint:
            remaining_meals = [meal_type for meal_type in remaining_meals if meal_type in scan_meal_hint]

    return jsonify(
        {
            "data": {
                "query": query,
                "student": serialize_student_item(student) if student else None,
                "ticket": {
                    "id": ticket.id,
                    "status": ticket.status,
                    "qr_code": ticket.qr_code,
                    "start_date": ticket.start_date.isoformat(),
                    "end_date": ticket.end_date.isoformat(),
                }
                if ticket
                else None,
                "allowed_meals": allowed_meals,
                "recent_meals": serialize_meal_records(recent_meals),
                "today_meals": serialize_meal_records(today_meals),
                "today_statuses": today_statuses,
                "remaining_meals": remaining_meals,
                "scan_meal_hint": scan_meal_hint,
                "issued_today_amount": issued_today_amount,
                "serving_today": is_service_day,
                "serving_block_reason": blocked_reason,
            }
        }
    )


@meals_bp.get("/offline-snapshot")
@login_required(roles=["cashier"])
def offline_snapshot(current_user):
    snapshot = build_cashier_offline_snapshot(
        current_user,
        configured_holidays=current_app.config.get("MEAL_HOLIDAYS"),
    )
    return jsonify({"data": snapshot})


@meals_bp.get("/cashier-journal")
@login_required(roles=["cashier", "head_social", "admin"])
def cashier_journal(current_user):
    try:
        journal_date, building_id = resolve_cashier_journal_request(current_user)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    payload = build_cashier_journal(
        target_date=journal_date,
        history_building_id=building_id,
    )
    return jsonify({"data": payload})


@meals_bp.post("/offline-sync")
@login_required(roles=["cashier"])
def offline_sync(current_user):
    payload = request.get_json(silent=True) or {}
    items = payload.get("items")
    if not isinstance(items, list):
        return jsonify({"error": "items must be an array"}), 400

    sync_results = run_offline_sync_batch(
        raw_items=items,
        process_item=lambda item_payload: process_offline_sync_item(current_user, item_payload),
    )
    summary = summarize_sync_results(sync_results)
    log_action(
        current_user,
        "offline_sync_meals",
        "meal_record",
        current_user.id,
        {"total_items": len(items), **summary},
    )
    serialized_results = [
        {
            "client_item_id": result.client_item_id,
            "request_id": result.request_id,
            "status": result.status,
            "http_status": result.http_status,
            "message": result.message,
            "data": result.data,
        }
        for result in sync_results
    ]

    return jsonify(
        {
            "data": {
                "results": serialized_results,
                "summary": summary,
            }
        }
    )


@meals_bp.post("/record")
@login_required(roles=["cashier", "head_social", "admin"])
def record_meal(current_user):
    payload = request.get_json(silent=True) or {}
    meal_type = payload.get("meal_type")
    code_meal_hint = resolve_payload_meal_hint(payload)
    ticket, student, issue_date, error_response, status_code = validate_issue_context(current_user, payload)
    if error_response is not None:
        return error_response if status_code is None else (error_response, status_code)

    if not meal_type or meal_type not in SUPPORTED_MEAL_TYPES:
        return jsonify({"error": "Некорректный тип питания"}), 400
    if meal_type not in student.category.meal_types:
        return jsonify({"error": "Для категории студента такой прием пищи не положен"}), 400

    if code_meal_hint and meal_type not in code_meal_hint:
        return jsonify({"error": "Р­С‚РѕС‚ РєРѕРґ РЅРµ РїРѕРґС…РѕРґРёС‚ РґР»СЏ РІС‹Р±СЂР°РЅРЅРѕРіРѕ РїСЂРёРµРјР° РїРёС‰Рё"}), 400

    duplicate = find_meal_record_duplicate(ticket.id, issue_date, meal_type)
    if duplicate:
        return build_meal_record_conflict_response("Питание по этому талону уже выдано")

    record = MealRecord(
        ticket_id=ticket.id,
        student_id=student.id,
        meal_type=meal_type,
        issue_date=issue_date,
        issue_time=datetime.now().time().replace(microsecond=0),
        issued_by=current_user.id,
        building_id=resolve_serving_building_id(current_user, student),
        price=Decimal(str(meal_price_for_category(student.category, meal_type))),
        notes=payload.get("notes"),
    )
    db.session.add(record)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        duplicate = find_meal_record_duplicate(ticket.id, issue_date, meal_type)
        if duplicate:
            return build_meal_record_conflict_response("Питание по этому талону уже выдано")
        return build_meal_record_conflict_response("Конфликт при выдаче питания")

    log_action(
        current_user,
        "record_meal",
        "meal_record",
        record.id,
        {"student_id": student.id, "meal_type": meal_type, "issue_date": issue_date.isoformat()},
    )
    return jsonify({"data": serialize_meal_record_item(record), "message": "Питание выдано"}), 201


@meals_bp.post("/confirm-selection")
@login_required(roles=["cashier", "head_social", "admin"])
def confirm_meal_selection(current_user):
    payload = request.get_json(silent=True) or {}
    result = confirm_meal_selection_request(
        current_user,
        payload,
        configured_holidays=current_app.config.get("MEAL_HOLIDAYS"),
    )
    return jsonify(result.response_body), result.http_status


@meals_bp.post("/record-all")
@login_required(roles=["cashier", "head_social", "admin"])
def record_all_meals(current_user):
    payload = request.get_json(silent=True) or {}
    code_meal_hint = resolve_payload_meal_hint(payload)
    ticket, student, issue_date, error_response, status_code = validate_issue_context(current_user, payload)
    if error_response is not None:
        return error_response if status_code is None else (error_response, status_code)

    today_records, _, remaining_meals, _ = build_day_statuses(student, ticket, issue_date)
    if code_meal_hint:
        remaining_meals = [meal_type for meal_type in remaining_meals if meal_type in code_meal_hint]
    if not remaining_meals:
        return build_meal_record_conflict_response("Питание по этому талону уже было выдано сегодня")

    created_records: list[MealRecord] = []
    for meal_type in remaining_meals:
        record = MealRecord(
            ticket_id=ticket.id,
            student_id=student.id,
            meal_type=meal_type,
            issue_date=issue_date,
            issue_time=datetime.now().time().replace(microsecond=0),
            issued_by=current_user.id,
            building_id=resolve_serving_building_id(current_user, student),
            price=Decimal(str(meal_price_for_category(student.category, meal_type))),
            notes=payload.get("notes"),
        )
        db.session.add(record)
        created_records.append(record)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        conflict_records = list_issue_meal_records(ticket.id, issue_date, remaining_meals)
        if conflict_records:
            return build_meal_record_conflict_response(
                "Питание по этому талону уже было выдано сегодня",
                build_record_all_conflict_payload(conflict_records),
            )
        return build_meal_record_conflict_response("Конфликт при выдаче питания")
    log_action(
        current_user,
        "record_meal_batch",
        "meal_record",
        ticket.id,
        {
            "student_id": student.id,
            "issue_date": issue_date.isoformat(),
            "issued_meals": remaining_meals,
            "already_issued_meals": [record.meal_type for record in today_records],
        },
    )

    return (
        jsonify(
            {
                "data": {
                    "records": serialize_meal_records(created_records),
                    "issued_meals": remaining_meals,
                    "already_issued_meals": [record.meal_type for record in today_records],
                    "total_amount": round(sum(float(record.price or 0) for record in created_records), 2),
                },
                "message": "Питание выдано",
            }
        ),
        201,
    )


@meals_bp.get("/today-stats")
@login_required(roles=["cashier", "head_social", "accountant", "admin"])
def today_stats(current_user):
    today = date.today()
    is_service_day, blocked_reason = get_service_day_context(today, current_app.config.get("MEAL_HOLIDAYS"))
    building_id = resolve_today_stats_building_id(current_user)
    students_query = Student.query.filter(Student.is_active.is_(True))
    tickets_query = Ticket.query.filter(Ticket.status == "active")
    meals_query = MealRecord.query.filter(MealRecord.issue_date == today)

    if building_id:
        students_query = students_query.filter(available_for_cashier_building_expr(building_id))
        tickets_query = tickets_query.join(Student).filter(available_for_cashier_building_expr(building_id))
        meals_query = meals_query.filter(MealRecord.building_id == building_id)

    meals = meals_query.all()
    breakfast = sum(1 for meal in meals if meal.meal_type == "breakfast")
    lunch = sum(1 for meal in meals if meal.meal_type == "lunch")
    cost = round(sum(float(meal.price or 0) for meal in meals), 2)

    by_category_query = (
        db.session.query(
            Student.category_id,
            func.count(MealRecord.id).label("count"),
            func.sum(MealRecord.price).label("amount"),
        )
        .join(Student, MealRecord.student_id == Student.id)
        .filter(MealRecord.issue_date == today)
    )
    if building_id:
        by_category_query = by_category_query.filter(MealRecord.building_id == building_id)
    by_category_rows = by_category_query.group_by(Student.category_id).all()

    category_lookup = {student.category_id: student.category.name for student in Student.query.all()}
    return jsonify(
        {
            "data": {
                "period": today.isoformat(),
                "studentsTotal": students_query.count(),
                "ticketsActive": tickets_query.count(),
                "mealsToday": len(meals),
                "breakfastToday": breakfast,
                "lunchToday": lunch,
                "costToday": cost,
                "serving_today": is_service_day,
                "serving_block_reason": blocked_reason,
                "byCategory": [
                    {
                        "category": category_lookup.get(row.category_id, "Без категории"),
                        "count": row.count,
                        "amount": round(float(row.amount or 0), 2),
                    }
                    for row in by_category_rows
                ],
            }
        }
    )


@meals_bp.get("/daily-summary")
@login_required(roles=["cashier", "head_social", "accountant", "admin"])
def daily_summary(current_user):
    days, building_id, month, year = resolve_cashier_summary_request(current_user)
    try:
        payload = build_cashier_daily_summary(
            days=days,
            history_building_id=building_id,
            month=month,
            year=year,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify({"data": payload})


@meals_bp.get("/daily-summary/xlsx")
@login_required(roles=["cashier", "head_social", "accountant", "admin"])
def daily_summary_xlsx(current_user):
    days, building_id, month, year = resolve_cashier_summary_request(current_user)
    try:
        workbook_bytes, filename = build_cashier_summary_workbook_bytes(
            days=days,
            history_building_id=building_id,
            month=month,
            year=year,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return send_file(
        BytesIO(workbook_bytes),
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@meals_bp.get("/report")
@login_required(roles=["head_social", "accountant", "admin"])
def meals_report(current_user):
    start_date = request.args.get("start_date") or request.args.get("period_start")
    end_date = request.args.get("end_date") or request.args.get("period_end")
    building_id = request.args.get("building_id", type=int)
    category_id = request.args.get("category_id", type=int)
    ticket_status = request.args.get("status")
    if not start_date or not end_date:
        return jsonify({"error": "Нужны start_date и end_date"}), 400

    period_start, start_error = parse_iso_date(start_date, "period_start")
    if start_error:
        return jsonify({"error": start_error}), 400

    period_end, end_error = parse_iso_date(end_date, "period_end")
    if end_error:
        return jsonify({"error": end_error}), 400

    return jsonify({"data": aggregate_meal_report(period_start, period_end, building_id, category_id, ticket_status)})
