from __future__ import annotations

import hashlib
from datetime import date

from app.models import Category, HolidayCalendar, MealRecord, Student, Ticket, utc_now
from app.serializers import serialize_category
from app.services.meals import get_service_day_context
from app.utils.buildings import building_name
from app.utils.meal_rules import SUPPORTED_MEAL_TYPES, meal_price_for_category, parse_holiday_dates
from app.utils.student_access import available_for_cashier_building_expr


def _snapshot_version(*, target_date: date, students_count: int, tickets_count: int, categories_count: int, holidays_count: int) -> str:
    base = f"{target_date.isoformat()}:{students_count}:{tickets_count}:{categories_count}:{holidays_count}"
    digest = hashlib.sha256(base.encode("utf-8")).hexdigest()[:16]
    return f"offline-cashier-v1-{digest}"


def _serialize_snapshot_student(student: Student) -> dict:
    return {
        "id": student.id,
        "full_name": student.full_name,
        "student_card": student.student_card,
        "group_name": student.group_name,
        "building_id": student.building_id,
        "meal_building_id": student.meal_building_id,
        "allow_all_meal_buildings": bool(student.allow_all_meal_buildings),
        "effective_meal_building_id": student.effective_meal_building_id,
        "category_id": student.category_id,
        "is_active": bool(student.is_active),
    }


def _build_service_day_snapshot_by_ticket(
    *,
    tickets: list[Ticket],
    students_by_id: dict[str, Student],
    categories_by_id: dict[int, Category],
    service_date: date,
) -> dict[str, dict]:
    if not tickets:
        return {}

    ticket_ids = [ticket.id for ticket in tickets]
    today_records = (
        MealRecord.query.filter(
            MealRecord.ticket_id.in_(ticket_ids),
            MealRecord.issue_date == service_date,
        )
        .order_by(MealRecord.issue_time.asc())
        .all()
    )

    records_by_ticket: dict[str, list[MealRecord]] = {}
    for record in today_records:
        records_by_ticket.setdefault(record.ticket_id, []).append(record)

    snapshot_by_ticket: dict[str, dict] = {}
    for ticket in tickets:
        student = students_by_id.get(ticket.student_id)
        category = categories_by_id.get(ticket.category_id)
        if student is None or category is None:
            snapshot_by_ticket[ticket.id] = {
                "today_statuses": [],
                "issued_today_amount": 0.0,
            }
            continue

        issued_map = {
            record.meal_type: record
            for record in records_by_ticket.get(ticket.id, [])
        }
        today_statuses = []
        for meal_type in category.meal_types:
            record = issued_map.get(meal_type)
            today_statuses.append(
                {
                    "meal_type": meal_type,
                    "issued": bool(record),
                    "price": meal_price_for_category(category, meal_type),
                    "issue_time": record.issue_time.isoformat() if record else None,
                }
            )

        snapshot_by_ticket[ticket.id] = {
            "today_statuses": today_statuses,
            "issued_today_amount": round(
                sum(float(record.price or 0) for record in records_by_ticket.get(ticket.id, [])),
                2,
            ),
        }

    return snapshot_by_ticket


def _serialize_snapshot_ticket(ticket: Ticket, service_day_snapshot: dict | None = None) -> dict:
    service_day_snapshot = service_day_snapshot or {}
    return {
        "id": ticket.id,
        "student_id": ticket.student_id,
        "category_id": ticket.category_id,
        "status": ticket.status,
        "qr_code": ticket.qr_code,
        "start_date": ticket.start_date.isoformat(),
        "end_date": ticket.end_date.isoformat(),
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        "today_statuses": service_day_snapshot.get("today_statuses", []),
        "issued_today_amount": service_day_snapshot.get("issued_today_amount", 0.0),
    }


def _serialize_snapshot_holiday(entry: HolidayCalendar) -> dict:
    return {
        "holiday_date": entry.holiday_date.isoformat(),
        "title": entry.title,
        "is_active": bool(entry.is_active),
    }


def _build_lookup_restrictions(current_user) -> list[dict]:
    remote_students = (
        Student.query.filter(
            Student.is_active.is_(True),
            ~available_for_cashier_building_expr(current_user.building_id),
        )
        .order_by(Student.id.asc())
        .all()
    )
    if not remote_students:
        return []

    student_ids = [student.id for student in remote_students]
    active_tickets = (
        Ticket.query.filter(
            Ticket.student_id.in_(student_ids),
            Ticket.status == "active",
        )
        .order_by(Ticket.created_at.desc())
        .all()
    )

    restrictions_by_key: dict[tuple[str, str], dict] = {}

    def add_restriction(*, lookup_kind: str, lookup_key: str | None, student: Student) -> None:
        normalized_lookup_key = (lookup_key or "").strip()
        if not normalized_lookup_key:
            return

        lookup_id = (lookup_kind, normalized_lookup_key.lower())
        if lookup_id in restrictions_by_key:
            return

        effective_meal_building_id = student.effective_meal_building_id
        restrictions_by_key[lookup_id] = {
            "lookup_key": normalized_lookup_key,
            "lookup_kind": lookup_kind,
            "reason": "cross_building",
            "effective_meal_building_id": effective_meal_building_id,
            "effective_meal_building_name": building_name(effective_meal_building_id),
        }

    remote_students_by_id = {student.id: student for student in remote_students}
    for student in remote_students:
        add_restriction(lookup_kind="student_card", lookup_key=student.student_card, student=student)

    for ticket in active_tickets:
        student = remote_students_by_id.get(ticket.student_id)
        if student is None:
            continue
        add_restriction(lookup_kind="ticket_id", lookup_key=ticket.id, student=student)
        add_restriction(lookup_kind="qr_code", lookup_key=ticket.qr_code, student=student)

    return list(restrictions_by_key.values())


def build_cashier_offline_snapshot(current_user, *, configured_holidays: str | None, target_date: date | None = None) -> dict:
    service_date = target_date or date.today()

    students = (
        Student.query.filter(
            Student.is_active.is_(True),
            available_for_cashier_building_expr(current_user.building_id),
        )
        .order_by(Student.full_name.asc())
        .all()
    )
    student_ids = [student.id for student in students]
    students_by_id = {student.id: student for student in students}

    categories = Category.query.order_by(Category.id.asc()).all()
    categories_by_id = {category.id: category for category in categories}

    tickets = []
    if student_ids:
        tickets = (
            Ticket.query.filter(
                Ticket.student_id.in_(student_ids),
                Ticket.status == "active",
            )
            .order_by(Ticket.created_at.desc())
            .all()
        )
    service_day_snapshot_by_ticket = _build_service_day_snapshot_by_ticket(
        tickets=tickets,
        students_by_id=students_by_id,
        categories_by_id=categories_by_id,
        service_date=service_date,
    )

    serving_today, serving_block_reason = get_service_day_context(service_date, configured_holidays)
    calendar_holidays = (
        HolidayCalendar.query.filter(HolidayCalendar.is_active.is_(True))
        .order_by(HolidayCalendar.holiday_date.asc())
        .all()
    )

    configured_holiday_dates = parse_holiday_dates(configured_holidays)
    merged_holiday_dates = {entry.holiday_date for entry in calendar_holidays}
    merged_holiday_dates.update(configured_holiday_dates)

    generated_at = utc_now().isoformat()
    lookup_restrictions = _build_lookup_restrictions(current_user)
    return {
        "generated_at": generated_at,
        "snapshot_version": _snapshot_version(
            target_date=service_date,
            students_count=len(students),
            tickets_count=len(tickets),
            categories_count=len(categories),
            holidays_count=len(merged_holiday_dates),
        ),
        "service_date": service_date.isoformat(),
        "building_id": current_user.building_id,
        "datasets": {
            "students": [_serialize_snapshot_student(student) for student in students],
            "tickets": [
                _serialize_snapshot_ticket(ticket, service_day_snapshot_by_ticket.get(ticket.id))
                for ticket in tickets
            ],
            "categories": [serialize_category(category) for category in categories],
            "holidays": [_serialize_snapshot_holiday(entry) for entry in calendar_holidays],
            "configured_holidays": sorted(holiday.isoformat() for holiday in configured_holiday_dates),
            "lookup_restrictions": lookup_restrictions,
        },
        "rules": {
            "supported_meal_types": list(SUPPORTED_MEAL_TYPES),
            "serving_today": serving_today,
            "serving_block_reason": serving_block_reason,
        },
    }

