from __future__ import annotations

import hashlib
import json
from datetime import date

from app.models import HolidayCalendar, MealRecord, MealSelectionRequest, Student, Ticket, utc_now
from app.utils.meal_rules import SUPPORTED_MEAL_TYPES, get_service_day_status, meal_price_for_category, parse_holiday_dates
from app.utils.official_holidays import ensure_official_holidays_for_years
from app.utils.ticket_codes import normalize_ticket_code, parse_ticket_code
from sqlalchemy import func

INACTIVE_STUDENT_MEAL_ISSUE_MESSAGE = "Студент выключен. Выдача питания недоступна"


def resolve_ticket_by_payload(payload_value: str | None):
    parsed_code = parse_ticket_code(payload_value)
    if not parsed_code:
        return None

    lowered = normalize_ticket_code(parsed_code.base_code).lower()
    return Ticket.query.filter(
        (func.lower(Ticket.id) == lowered) | (func.lower(Ticket.qr_code) == lowered)
    ).first()


def resolve_meal_hint_from_code(payload_value: str | None) -> list[str]:
    parsed_code = parse_ticket_code(payload_value)
    if not parsed_code or not parsed_code.meal_hint:
        return []
    return list(parsed_code.meal_hint)


def resolve_payload_meal_hint(payload: dict) -> list[str]:
    for key in ("code", "qr_code"):
        value = payload.get(key)
        if not value:
            continue
        hint = resolve_meal_hint_from_code(value)
        if hint:
            return hint
    return []


def get_day_meals(ticket: Ticket, issue_date: date) -> list[MealRecord]:
    return (
        MealRecord.query.filter_by(ticket_id=ticket.id, issue_date=issue_date)
        .order_by(MealRecord.issue_time.asc())
        .all()
    )


def build_day_statuses(student: Student | None, ticket: Ticket | None, issue_date: date):
    if not student or not ticket:
        return [], [], [], 0.0

    today_records = get_day_meals(ticket, issue_date)
    issued_map = {record.meal_type: record for record in today_records}
    statuses = []
    for meal_type in student.category.meal_types:
        record = issued_map.get(meal_type)
        statuses.append(
            {
                "meal_type": meal_type,
                "issued": bool(record),
                "price": meal_price_for_category(student.category, meal_type),
                "issue_time": record.issue_time.isoformat() if record else None,
            }
        )

    remaining_meals = [status["meal_type"] for status in statuses if not status["issued"]]
    issued_today_amount = round(sum(float(record.price or 0) for record in today_records), 2)
    return today_records, statuses, remaining_meals, issued_today_amount


def resolve_serving_building_id(user, student: Student) -> int:
    return int(user.building_id or student.effective_meal_building_id)


def normalize_selected_meals(raw_meals) -> list[str]:
    if not isinstance(raw_meals, list):
        return []

    selected: list[str] = []
    seen: set[str] = set()
    for meal_type in raw_meals:
        if not isinstance(meal_type, str):
            continue
        normalized = meal_type.strip().lower()
        if normalized in SUPPORTED_MEAL_TYPES and normalized not in seen:
            selected.append(normalized)
            seen.add(normalized)
    return selected


def find_meal_selection_request(request_id: str | None):
    if not request_id:
        return None
    return MealSelectionRequest.query.filter_by(request_id=request_id).first()


def normalize_request_value(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def build_meal_selection_request_fingerprint(payload: dict, selected_meals: list[str]) -> str:
    normalized_payload = {
        "ticket_id": normalize_request_value(payload.get("ticket_id")),
        "student_id": normalize_request_value(payload.get("student_id")),
        "code": normalize_request_value(payload.get("code")),
        "qr_code": normalize_request_value(payload.get("qr_code")),
        "issue_date": normalize_request_value(payload.get("issue_date")),
        "selected_meals": list(selected_meals),
        "notes": normalize_request_value(payload.get("notes")),
    }
    serialized = json.dumps(normalized_payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def build_meal_selection_response_payload(
    *,
    records: list[dict],
    issued_meals: list[str],
    already_issued_meals: list[str],
    rejected_meals: list[str],
    total_amount: float,
    request_id: str,
) -> dict:
    return {
        "records": records,
        "issued_meals": issued_meals,
        "already_issued_meals": already_issued_meals,
        "rejected_meals": rejected_meals,
        "total_amount": total_amount,
        "request_id": request_id,
    }


def finalize_meal_selection_request(
    meal_request: MealSelectionRequest,
    *,
    response_status: int,
    response_body: dict,
) -> None:
    meal_request.response_status = response_status
    meal_request.response_payload = response_body
    meal_request.completed_at = utc_now()


def replay_meal_selection_status(meal_request: MealSelectionRequest) -> int:
    if meal_request.response_status is None:
        return 409
    if 200 <= meal_request.response_status < 300:
        return 200
    return meal_request.response_status


def get_selected_day_meals(ticket: Ticket, issue_date: date, selected_meals: list[str]) -> list[MealRecord]:
    if not selected_meals:
        return []
    return (
        MealRecord.query.filter(
            MealRecord.ticket_id == ticket.id,
            MealRecord.issue_date == issue_date,
            MealRecord.meal_type.in_(selected_meals),
        )
        .order_by(MealRecord.issue_time.asc())
        .all()
    )


def resolve_ticket_from_payload(payload: dict):
    ticket = None
    code = payload.get("code")

    if payload.get("ticket_id"):
        ticket = Ticket.query.filter_by(id=payload["ticket_id"]).first()
    elif payload.get("qr_code"):
        ticket = resolve_ticket_by_payload(payload["qr_code"])
    elif code:
        ticket = resolve_ticket_by_payload(code)

    if not ticket and payload.get("student_id"):
        ticket = (
            Ticket.query.filter_by(student_id=payload["student_id"], status="active")
            .order_by(Ticket.created_at.desc())
            .first()
        )

    if not ticket and code:
        student = Student.query.filter(
            (Student.student_card == code)
            | (Student.id == code)
            | (Student.full_name.ilike(f"%{code}%"))
        ).first()
        if student:
            ticket = (
                Ticket.query.filter_by(student_id=student.id, status="active")
                .order_by(Ticket.created_at.desc())
                .first()
            )

    return ticket


def can_issue_meals_to_student(student: Student | None) -> bool:
    return bool(student and student.is_active)


def parse_iso_date(value: str, field_name: str) -> tuple[date | None, str | None]:
    try:
        return date.fromisoformat(value), None
    except ValueError:
        return None, f"РќРµРєРѕСЂСЂРµРєС‚РЅР°СЏ РґР°С‚Р° РІ РїРѕР»Рµ {field_name}, РЅСѓР¶РµРЅ YYYY-MM-DD"


def get_service_day_context(target_date: date, configured_holidays) -> tuple[bool, str | None]:
    ensure_official_holidays_for_years({target_date.year})
    holidays = parse_holiday_dates(configured_holidays)
    holidays.update(entry.holiday_date for entry in HolidayCalendar.query.filter(HolidayCalendar.is_active.is_(True)).all())
    return get_service_day_status(target_date, holidays)


def resolve_issue_context(payload: dict, configured_holidays):
    ticket = resolve_ticket_from_payload(payload)
    if not ticket:
        return None, None, None, "РўР°Р»РѕРЅ РЅРµ РЅР°Р№РґРµРЅ", 404

    student = ticket.student
    if ticket.status != "active":
        return None, None, None, "РўР°Р»РѕРЅ РЅРµР°РєС‚РёРІРµРЅ", 409

    if not can_issue_meals_to_student(student):
        return None, None, None, INACTIVE_STUDENT_MEAL_ISSUE_MESSAGE, 409

    if payload.get("issue_date"):
        issue_date, parse_error = parse_iso_date(payload["issue_date"], "issue_date")
        if parse_error:
            return None, None, None, parse_error, 400
    else:
        issue_date = date.today()

    is_service_day, blocked_reason = get_service_day_context(issue_date, configured_holidays)
    if not is_service_day:
        return None, None, None, blocked_reason or "РЎРµРіРѕРґРЅСЏ РїРёС‚Р°РЅРёРµ РЅРµ РІС‹РґР°РµС‚СЃСЏ", 409

    if ticket.start_date > issue_date or ticket.end_date < issue_date:
        return None, None, None, "РўР°Р»РѕРЅ РЅРµ РґРµР№СЃС‚РІСѓРµС‚ РЅР° РІС‹Р±СЂР°РЅРЅСѓСЋ РґР°С‚Сѓ", 400

    return ticket, student, issue_date, None, None


def aggregate_meal_report(
    period_start: date,
    period_end: date,
    building_id: int | None = None,
    category_id: int | None = None,
    ticket_status: str | None = None,
):
    rows = {}
    total_count = 0
    total_amount = 0.0

    query = MealRecord.query.join(Student).join(Ticket, MealRecord.ticket_id == Ticket.id)
    query = query.filter(MealRecord.issue_date.between(period_start, period_end))
    if building_id:
        query = query.filter(MealRecord.building_id == building_id)
    if category_id:
        query = query.filter(Student.category_id == category_id)
    if ticket_status:
        query = query.filter(Ticket.status == ticket_status)

    records = query.all()
    for record in records:
        key = (record.student.category.name, record.meal_type)
        current = rows.get(key, {"category": key[0], "meal_type": key[1], "count": 0, "amount": 0.0})
        current["count"] += 1
        current["amount"] += float(record.price or 0)
        rows[key] = current
        total_count += 1
        total_amount += float(record.price or 0)

    return {
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "rows": list(rows.values()),
        "totals": {"count": total_count, "amount": round(total_amount, 2)},
    }
