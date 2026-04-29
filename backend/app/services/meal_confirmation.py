from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.exc import IntegrityError

from app.models import MealRecord, MealSelectionRequest, db
from app.serializer_state import serialize_meal_records
from app.services.meals import (
    build_day_statuses,
    build_meal_selection_request_fingerprint,
    build_meal_selection_response_payload,
    finalize_meal_selection_request,
    find_meal_selection_request,
    get_selected_day_meals,
    normalize_selected_meals,
    replay_meal_selection_status,
    resolve_issue_context,
    resolve_payload_meal_hint,
    resolve_serving_building_id,
)
from app.utils.audit import log_action
from app.utils.meal_rules import meal_price_for_category
from app.utils.student_access import build_student_access_error_message, has_student_access


@dataclass(slots=True)
class MealConfirmationResult:
    http_status: int
    response_body: dict[str, Any]


def _error_result(message: str, status_code: int, *, data: dict[str, Any] | None = None) -> MealConfirmationResult:
    response_body: dict[str, Any] = {"error": message}
    if data is not None:
        response_body["data"] = data
    return MealConfirmationResult(http_status=status_code, response_body=response_body)


def _build_request_conflict_result(request_id: str) -> MealConfirmationResult:
    return _error_result(
        "Этот request_id уже используется для другого запроса",
        409,
        data={"request_id": request_id},
    )


def _build_processing_result(request_id: str) -> MealConfirmationResult:
    return _error_result(
        "Запрос подтверждения уже обрабатывается",
        409,
        data={"request_id": request_id},
    )


def _build_existing_request_result(
    existing_request: MealSelectionRequest | None,
    *,
    request_id: str,
    request_fingerprint: str,
) -> MealConfirmationResult:
    if existing_request is None:
        return _build_processing_result(request_id)

    if existing_request.request_fingerprint != request_fingerprint:
        return _build_request_conflict_result(request_id)

    if existing_request.response_status is None:
        return _build_processing_result(request_id)

    return MealConfirmationResult(
        http_status=replay_meal_selection_status(existing_request),
        response_body=existing_request.response_payload or {"data": {"request_id": request_id}},
    )


def _validate_issue_context(current_user, payload: dict[str, Any], configured_holidays):
    ticket, student, issue_date, error_message, status_code = resolve_issue_context(payload, configured_holidays)
    if error_message:
        return None, None, None, _error_result(error_message, status_code or 400)

    if not has_student_access(current_user, student):
        return None, None, None, _error_result(build_student_access_error_message(current_user, student), 403)

    return ticket, student, issue_date, None


def _build_meal_record(current_user, student, ticket_id: str, issue_date, meal_type: str, notes: Any) -> MealRecord:
    return MealRecord(
        ticket_id=ticket_id,
        student_id=student.id,
        meal_type=meal_type,
        issue_date=issue_date,
        issue_time=datetime.now().time().replace(microsecond=0),
        issued_by=current_user.id,
        building_id=resolve_serving_building_id(current_user, student),
        price=Decimal(str(meal_price_for_category(student.category, meal_type))),
        notes=notes,
    )


def confirm_meal_selection_request(current_user, payload: dict[str, Any], *, configured_holidays) -> MealConfirmationResult:
    selected_meals = normalize_selected_meals(payload.get("selected_meals"))
    request_id = (payload.get("request_id") or "").strip()

    if not selected_meals:
        return _error_result("Не выбран ни один прием пищи", 400)

    if not request_id:
        return _error_result("Нужен request_id", 400)

    request_fingerprint = build_meal_selection_request_fingerprint(payload, selected_meals)
    existing_request = find_meal_selection_request(request_id)
    if existing_request is not None:
        return _build_existing_request_result(
            existing_request,
            request_id=request_id,
            request_fingerprint=request_fingerprint,
        )

    ticket, student, issue_date, error_result = _validate_issue_context(
        current_user,
        payload,
        configured_holidays,
    )
    if error_result is not None:
        return error_result

    meal_request = MealSelectionRequest(
        request_id=request_id,
        request_fingerprint=request_fingerprint,
        ticket_id=ticket.id,
        issue_date=issue_date,
        created_by=current_user.id,
    )
    db.session.add(meal_request)
    try:
        db.session.flush()
    except IntegrityError:
        db.session.rollback()
        return _build_existing_request_result(
            find_meal_selection_request(request_id),
            request_id=request_id,
            request_fingerprint=request_fingerprint,
        )

    code_meal_hint = resolve_payload_meal_hint(payload)
    allowed_meals = set(student.category.meal_types)
    if code_meal_hint:
        allowed_meals &= set(code_meal_hint)

    invalid_meals = [meal_type for meal_type in selected_meals if meal_type not in allowed_meals]
    today_records, _, _, _ = build_day_statuses(student, ticket, issue_date)
    issued_map = {record.meal_type: record for record in today_records}
    already_issued_meals = [meal_type for meal_type in selected_meals if meal_type in issued_map]
    creatable_meals = [meal_type for meal_type in selected_meals if meal_type in allowed_meals and meal_type not in issued_map]

    created_records: list[MealRecord] = []
    insertion_conflict = False
    try:
        with db.session.begin_nested():
            for meal_type in creatable_meals:
                record = _build_meal_record(current_user, student, ticket.id, issue_date, meal_type, payload.get("notes"))
                db.session.add(record)
                created_records.append(record)
            if created_records:
                db.session.flush()
    except IntegrityError:
        insertion_conflict = True
        created_records = []

    selected_records = get_selected_day_meals(ticket, issue_date, selected_meals)
    audit_details = {
        "student_id": student.id,
        "issue_date": issue_date.isoformat(),
        "selected_meals": selected_meals,
        "request_id": request_id,
    }

    if insertion_conflict or not created_records:
        final_issued_map = {record.meal_type: record for record in selected_records}
        conflict_already_issued = [meal_type for meal_type in selected_meals if meal_type in final_issued_map]
        response_payload = build_meal_selection_response_payload(
            records=serialize_meal_records(selected_records),
            issued_meals=[],
            already_issued_meals=conflict_already_issued,
            rejected_meals=invalid_meals,
            total_amount=0.0,
            request_id=request_id,
        )
        response_body = {
            "error": "Выбранные приемы пищи недоступны или уже выданы",
            "data": response_payload,
        }
        finalize_meal_selection_request(meal_request, response_status=409, response_body=response_body)
        db.session.commit()
        audit_details.update(
            {
                "issued_meals": [],
                "already_issued_meals": conflict_already_issued,
                "rejected_meals": invalid_meals,
                "total_amount": 0.0,
            }
        )
        log_action(current_user, "confirm_meal_selection", "meal_record", ticket.id, audit_details)
        return MealConfirmationResult(http_status=409, response_body=response_body)

    total_amount = round(sum(float(record.price or 0) for record in created_records), 2)
    response_payload = build_meal_selection_response_payload(
        records=serialize_meal_records(created_records),
        issued_meals=creatable_meals,
        already_issued_meals=already_issued_meals,
        rejected_meals=invalid_meals,
        total_amount=total_amount,
        request_id=request_id,
    )
    response_body = {"data": response_payload, "message": "Питание подтверждено"}
    finalize_meal_selection_request(meal_request, response_status=201, response_body=response_body)
    db.session.commit()
    audit_details.update(
        {
            "issued_meals": creatable_meals,
            "already_issued_meals": already_issued_meals,
            "rejected_meals": invalid_meals,
            "total_amount": total_amount,
        }
    )
    log_action(current_user, "confirm_meal_selection", "meal_record", ticket.id, audit_details)
    return MealConfirmationResult(http_status=201, response_body=response_body)
