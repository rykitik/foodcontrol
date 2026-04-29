from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy import func

from app.models import MealRecord, Student, Ticket, db
from app.services.ticket_periods import split_ticket_period_by_month
from app.utils.validators import normalize_period
from app.utils.ticket_codes import ensure_ticket_scan_code


def build_ticket(student: Student, current_user_id: str, start_date: date, end_date: date) -> Ticket:
    ticket = Ticket(
        student_id=student.id,
        category_id=student.category_id,
        month=start_date.month,
        year=start_date.year,
        start_date=start_date,
        end_date=end_date,
        created_by=current_user_id,
        qr_code="",
    )
    db.session.add(ticket)
    db.session.flush()
    ensure_ticket_scan_code(ticket)
    return ticket


def build_ticket_batch(student: Student, current_user_id: str, start_date: date, end_date: date) -> list[Ticket]:
    return [
        build_ticket(student, current_user_id, segment.start_date, segment.end_date)
        for segment in split_ticket_period_by_month(start_date, end_date)
    ]


def reissue_ticket(ticket: Ticket, current_user_id: str) -> Ticket:
    ticket.status = "cancelled"
    db.session.flush()

    replacement = build_ticket(ticket.student, current_user_id, ticket.start_date, ticket.end_date)

    MealRecord.query.filter_by(ticket_id=ticket.id).update(
        {MealRecord.ticket_id: replacement.id},
        synchronize_session=False,
    )

    return replacement


@dataclass(frozen=True)
class TicketEndDateChangeResult:
    previous_end_date: date
    next_end_date: date
    previous_status: str
    next_status: str
    last_meal_date: date | None


def resolve_ticket_end_date_change(
    ticket: Ticket,
    end_date_value,
) -> tuple[TicketEndDateChangeResult | None, str | None, int | None]:
    if ticket.status == "cancelled":
        return None, "У отмененного талона нельзя менять срок действия", 409

    parsed_period = normalize_period(ticket.start_date.isoformat(), end_date_value)
    if isinstance(parsed_period[0], str):
        return None, parsed_period[0], parsed_period[1]

    _start_date, next_end_date = parsed_period
    last_meal_date = (
        db.session.query(func.max(MealRecord.issue_date))
        .filter(MealRecord.ticket_id == ticket.id)
        .scalar()
    )
    if last_meal_date and next_end_date < last_meal_date:
        return (
            None,
            f"Нельзя установить дату окончания раньше последней выдачи питания: {last_meal_date.strftime('%d.%m.%Y')}",
            409,
        )

    next_status = ticket.status
    if ticket.status in {"active", "expired"}:
        next_status = "expired" if next_end_date < date.today() else "active"

    return (
        TicketEndDateChangeResult(
            previous_end_date=ticket.end_date,
            next_end_date=next_end_date,
            previous_status=ticket.status,
            next_status=next_status,
            last_meal_date=last_meal_date,
        ),
        None,
        None,
    )
