from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING, cast

from app.models import Category, HolidayCalendar, Log, MealRecord, Student, Ticket, User
from app.utils.buildings import building_name
from app.utils.meal_rules import configured_meal_prices_for_category

if TYPE_CHECKING:
    from app.serializer_state import (
        LogSerializerState,
        MealRecordSerializerState,
        StudentSerializerState,
        TicketSerializerState,
    )


_MISSING_STATE = object()


def _serializer_usage_hint(*, batch_wrapper: str, item_wrapper: str, builder_name: str) -> str:
    return (
        f"Use {batch_wrapper}() or {item_wrapper}(), "
        f"or build state with {builder_name}() and pass state= explicitly."
    )


def _resolve_serializer_state(
    state: object,
    *,
    serializer_name: str,
    required_state_name: str,
    required_attributes: tuple[str, ...],
    batch_wrapper: str,
    item_wrapper: str,
    builder_name: str,
):
    usage_hint = _serializer_usage_hint(
        batch_wrapper=batch_wrapper,
        item_wrapper=item_wrapper,
        builder_name=builder_name,
    )
    if state is _MISSING_STATE or state is None:
        raise TypeError(f"{serializer_name} requires explicit {required_state_name}. {usage_hint}")

    missing_attributes = [attribute for attribute in required_attributes if not hasattr(state, attribute)]
    if missing_attributes:
        missing_list = ", ".join(missing_attributes)
        raise TypeError(
            f"{serializer_name} expected {required_state_name} with attributes: {missing_list}. {usage_hint}"
        )

    return state


def _require_mapping_value(mapping: dict, key, *, field_name: str):
    if key not in mapping:
        raise ValueError(f"Missing serializer state for {field_name}: {key}")
    return mapping[key]


def serialize_category(category: Category):
    configured_prices = configured_meal_prices_for_category(category)
    return {
        "id": category.id,
        "name": category.name,
        "code": category.code,
        "breakfast": category.breakfast,
        "lunch": category.lunch,
        "breakfast_price": configured_prices["breakfast"],
        "lunch_price": configured_prices["lunch"],
        "description": category.description,
        "color": category.color,
        "is_active": category.is_active,
        "meal_types": category.meal_types,
        "meal_prices": category.meal_prices,
    }


def serialize_user(user: User):
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "building_id": user.building_id,
        "building_name": building_name(user.building_id),
        "is_active": user.is_active,
        "last_login": user.last_login.isoformat() if user.last_login else None,
    }


def serialize_student(
    student: Student,
    include_active_ticket: bool = True,
    *,
    state: StudentSerializerState | object = _MISSING_STATE,
):
    resolved_state = cast(
        "StudentSerializerState",
        _resolve_serializer_state(
            state,
            serializer_name="serialize_student",
            required_state_name="StudentSerializerState",
            required_attributes=("category_payloads_by_category_id", "active_ticket_ids_by_student_id"),
            batch_wrapper="serialize_students",
            item_wrapper="serialize_student_item",
            builder_name="build_student_serializer_state",
        ),
    )
    return _serialize_student_with_state(student, include_active_ticket=include_active_ticket, state=resolved_state)


def _serialize_student_with_state(
    student: Student,
    include_active_ticket: bool = True,
    *,
    state: StudentSerializerState,
):
    category_payload = _require_mapping_value(
        state.category_payloads_by_category_id,
        student.category_id,
        field_name="student.category_id",
    )
    active_ticket_id = state.active_ticket_ids_by_student_id.get(student.id) if include_active_ticket else None

    return {
        "id": student.id,
        "full_name": student.full_name,
        "student_card": student.student_card,
        "group_name": student.group_name,
        "building_id": student.building_id,
        "building_name": building_name(student.building_id),
        "meal_building_id": student.meal_building_id,
        "meal_building_name": building_name(student.meal_building_id),
        "allow_all_meal_buildings": student.allow_all_meal_buildings,
        "effective_meal_building_id": student.effective_meal_building_id,
        "effective_meal_building_name": building_name(student.effective_meal_building_id),
        "category_id": student.category_id,
        "is_active": student.is_active,
        "category": category_payload,
        "active_ticket_id": active_ticket_id,
    }


def serialize_ticket(
    ticket: Ticket,
    include_student: bool = False,
    *,
    state: TicketSerializerState | object = _MISSING_STATE,
):
    resolved_state = cast(
        "TicketSerializerState",
        _resolve_serializer_state(
            state,
            serializer_name="serialize_ticket",
            required_state_name="TicketSerializerState",
            required_attributes=(
                "students_by_id",
                "category_payloads_by_category_id",
                "creator_names_by_user_id",
                "meal_record_counts_by_ticket_id",
                "active_ticket_counts_by_period",
            ),
            batch_wrapper="serialize_tickets",
            item_wrapper="serialize_ticket_item",
            builder_name="build_ticket_serializer_state",
        ),
    )
    return _serialize_ticket_with_state(ticket, include_student=include_student, state=resolved_state)


def _serialize_ticket_with_state(
    ticket: Ticket,
    include_student: bool = False,
    *,
    state: TicketSerializerState,
):
    student = _require_mapping_value(state.students_by_id, ticket.student_id, field_name="ticket.student_id")
    category_payload = _require_mapping_value(
        state.category_payloads_by_category_id,
        ticket.category_id,
        field_name="ticket.category_id",
    )
    creator_name = _require_mapping_value(
        state.creator_names_by_user_id,
        ticket.created_by,
        field_name="ticket.created_by",
    )
    meal_records_count = state.meal_record_counts_by_ticket_id.get(ticket.id, 0)
    is_overdue = ticket.end_date < date.today() and ticket.status in {"active", "expired"}
    effective_meal_building_id = student.effective_meal_building_id
    effective_meal_building_name = building_name(effective_meal_building_id)
    active_period_key = (ticket.student_id, ticket.month, ticket.year)
    active_period_count = state.active_ticket_counts_by_period.get(active_period_key, 0)
    has_conflict = active_period_count > 1 if ticket.status == "active" else active_period_count > 0

    payload = {
        "id": ticket.id,
        "student_id": ticket.student_id,
        "student_name": student.full_name,
        "building_id": effective_meal_building_id,
        "building_name": effective_meal_building_name,
        "source_building_id": student.building_id,
        "source_building_name": building_name(student.building_id),
        "meal_building_id": student.meal_building_id,
        "meal_building_name": building_name(student.meal_building_id),
        "allow_all_meal_buildings": student.allow_all_meal_buildings,
        "effective_meal_building_id": effective_meal_building_id,
        "effective_meal_building_name": effective_meal_building_name,
        "category_id": ticket.category_id,
        "category_name": category_payload["name"],
        "month": ticket.month,
        "year": ticket.year,
        "start_date": ticket.start_date.isoformat(),
        "end_date": ticket.end_date.isoformat(),
        "status": ticket.status,
        "qr_code": ticket.qr_code,
        "created_by": ticket.created_by,
        "created_by_name": creator_name,
        "created_at": ticket.created_at.isoformat(),
        "meal_records_count": meal_records_count,
        "is_locked": meal_records_count > 0,
        "is_overdue": is_overdue,
        "requires_attention": is_overdue or has_conflict,
    }
    if include_student:
        if state.student_state is None:
            raise ValueError("Missing nested student serializer state")
        payload["student"] = _serialize_student_with_state(student, state=state.student_state)
    return payload


def serialize_meal_record(
    record: MealRecord,
    include_student: bool = False,
    *,
    state: MealRecordSerializerState | object = _MISSING_STATE,
):
    resolved_state = cast(
        "MealRecordSerializerState",
        _resolve_serializer_state(
            state,
            serializer_name="serialize_meal_record",
            required_state_name="MealRecordSerializerState",
            required_attributes=(
                "students_by_id",
                "category_payloads_by_category_id",
                "cashier_names_by_user_id",
            ),
            batch_wrapper="serialize_meal_records",
            item_wrapper="serialize_meal_record_item",
            builder_name="build_meal_record_serializer_state",
        ),
    )
    return _serialize_meal_record_with_state(record, include_student=include_student, state=resolved_state)


def _serialize_meal_record_with_state(
    record: MealRecord,
    include_student: bool = False,
    *,
    state: MealRecordSerializerState,
):
    student = _require_mapping_value(state.students_by_id, record.student_id, field_name="meal_record.student_id")
    category_payload = _require_mapping_value(
        state.category_payloads_by_category_id,
        student.category_id,
        field_name="meal_record.category_id",
    )
    cashier_name = _require_mapping_value(
        state.cashier_names_by_user_id,
        record.issued_by,
        field_name="meal_record.issued_by",
    )
    payload = {
        "id": record.id,
        "ticket_id": record.ticket_id,
        "student_id": record.student_id,
        "student_name": student.full_name,
        "meal_type": record.meal_type,
        "issue_date": record.issue_date.isoformat(),
        "issue_time": record.issue_time.isoformat(),
        "issued_by": record.issued_by,
        "issued_by_name": cashier_name,
        "building_id": record.building_id,
        "category_name": category_payload["name"],
        "price": float(record.price or 0),
        "notes": record.notes,
    }
    if include_student:
        if state.student_state is None:
            raise ValueError("Missing nested student serializer state")
        payload["student"] = _serialize_student_with_state(student, state=state.student_state)
    return payload


def serialize_holiday(entry: HolidayCalendar):
    return {
        "id": entry.id,
        "holiday_date": entry.holiday_date.isoformat(),
        "title": entry.title,
        "is_active": entry.is_active,
        "created_by": entry.created_by,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
        "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
    }


def serialize_log(entry: Log, *, state: LogSerializerState | object = _MISSING_STATE):
    resolved_state = cast(
        "LogSerializerState",
        _resolve_serializer_state(
            state,
            serializer_name="serialize_log",
            required_state_name="LogSerializerState",
            required_attributes=("user_names_by_user_id",),
            batch_wrapper="serialize_logs",
            item_wrapper="serialize_log_item",
            builder_name="build_log_serializer_state",
        ),
    )
    return _serialize_log_with_state(entry, state=resolved_state)


def _serialize_log_with_state(entry: Log, *, state: LogSerializerState):
    user_name = state.user_names_by_user_id.get(entry.user_id) if entry.user_id else None
    return {
        "id": entry.id,
        "user_id": entry.user_id,
        "user_name": user_name or "Система",
        "action": entry.action,
        "entity_type": entry.entity_type,
        "entity_id": entry.entity_id,
        "details": entry.details or {},
        "ip_address": entry.ip_address,
        "user_agent": entry.user_agent,
        "created_at": entry.created_at.isoformat(),
    }
