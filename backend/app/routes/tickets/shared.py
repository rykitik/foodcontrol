from __future__ import annotations

from flask import jsonify

from app.auth import ensure_building_access
from app.models import Ticket
from app.services.ticket_periods import resolve_ticket_creation_period as resolve_ticket_creation_period_service
from app.services.ticket_periods import resolve_ticket_issue_period
from app.utils.student_access import (
    assigned_to_meal_building_expr,
    available_for_cashier_building_expr,
    has_student_management_access,
    visible_to_social_building_expr,
)
from app.utils.validators import resolve_month_period


def resolve_ticket_period(month_value, year_value):
    period = resolve_month_period(month_value, year_value)
    if isinstance(period, tuple) and len(period) == 2 and isinstance(period[0], str):
        return None, jsonify({"error": period[0]}), period[1]
    return period, None, None


def resolve_ticket_creation_period(month_value, year_value):
    period, error_message, status_code = resolve_ticket_creation_period_service(
        month_value=month_value,
        year_value=year_value,
    )
    if error_message:
        return None, jsonify({"error": error_message}), status_code
    return period, None, None


def resolve_ticket_issue_period_payload(payload: dict):
    period, error_message, status_code = resolve_ticket_issue_period(
        month_value=payload.get("month"),
        year_value=payload.get("year"),
        start_date_value=payload.get("start_date"),
        end_date_value=payload.get("end_date"),
    )
    if error_message:
        return None, jsonify({"error": error_message}), status_code
    return period, None, None


def resolve_ticket_creation_period_payload(payload: dict):
    period, error_message, status_code = resolve_ticket_creation_period_service(
        month_value=payload.get("month"),
        year_value=payload.get("year"),
        start_date_value=payload.get("start_date"),
        end_date_value=payload.get("end_date"),
    )
    if error_message:
        return None, jsonify({"error": error_message}), status_code
    return period, None, None


def resolve_ticket_print_size(raw_value) -> str:
    return "large" if raw_value == "large" else "compact"


def resolve_optional_building_id(current_user, raw_building_id):
    if raw_building_id is None:
        return None, None

    building_id = int(raw_building_id)
    if current_user.role == "social":
        access_error = ensure_building_access(current_user, building_id)
        if access_error:
            return None, access_error

    return building_id, None


def resolve_document_filters(current_user, payload):
    building_id, access_error = resolve_optional_building_id(
        current_user,
        payload.get("building_id", current_user.building_id),
    )
    if access_error:
        return None, None, access_error

    category_id = payload.get("category_id")
    if category_id is not None:
        category_id = int(category_id)

    return building_id, category_id, None


def apply_ticket_scope(query, current_user, building_id: int | None):
    if current_user.role == "social":
        return query.filter(visible_to_social_building_expr(current_user.building_id))
    if current_user.role == "cashier":
        return query.filter(available_for_cashier_building_expr(current_user.building_id))
    if building_id:
        return query.filter(assigned_to_meal_building_expr(building_id))
    return query


def ensure_ticket_access(current_user, ticket: Ticket):
    if has_student_management_access(current_user, ticket.student):
        return None
    return jsonify({"error": "Доступ к талону запрещен"}), 403
