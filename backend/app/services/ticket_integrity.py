from __future__ import annotations

from app.models import Ticket
from app.services.ticket_periods import TicketPeriodSegment, split_ticket_period_by_month


def find_active_ticket(student_id: str, month: int, year: int, *, exclude_ticket_id: str | None = None) -> Ticket | None:
    query = Ticket.query.filter_by(
        student_id=student_id,
        month=month,
        year=year,
        status="active",
    )
    if exclude_ticket_id:
        query = query.filter(Ticket.id != exclude_ticket_id)
    return query.first()


def find_active_ticket_period_conflict(
    student_id: str,
    start_date,
    end_date,
    *,
    exclude_ticket_id: str | None = None,
) -> tuple[Ticket | None, TicketPeriodSegment | None]:
    for segment in split_ticket_period_by_month(start_date, end_date):
        conflict = find_active_ticket(
            student_id,
            segment.month,
            segment.year,
            exclude_ticket_id=exclude_ticket_id,
        )
        if conflict:
            return conflict, segment

    return None, None
