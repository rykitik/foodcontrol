from __future__ import annotations

from calendar import monthrange
from dataclasses import dataclass
from datetime import date, timedelta

from app.utils.validators import normalize_period, resolve_month_period


@dataclass(frozen=True)
class TicketPeriodSegment:
    month: int
    year: int
    start_date: date
    end_date: date


def resolve_ticket_issue_period(
    *,
    month_value=None,
    year_value=None,
    start_date_value=None,
    end_date_value=None,
):
    has_range = start_date_value is not None or end_date_value is not None
    if has_range:
        period = normalize_period(start_date_value, end_date_value)
        if isinstance(period[0], str):
            return None, period[0], period[1]
        start_date, end_date = period
        return (start_date, end_date), None, None

    period = resolve_month_period(month_value, year_value)
    if isinstance(period[0], str):
        return None, period[0], period[1]
    return period, None, None


def resolve_ticket_creation_period(
    *,
    month_value=None,
    year_value=None,
    start_date_value=None,
    end_date_value=None,
):
    has_range = start_date_value is not None or end_date_value is not None
    today = date.today()

    if has_range:
        period, error_message, status_code = resolve_ticket_issue_period(
            month_value=month_value,
            year_value=year_value,
            start_date_value=start_date_value,
            end_date_value=end_date_value,
        )
        if error_message:
            return None, error_message, status_code

        start_date, end_date = period
        if start_date < today:
            return None, "При создании талона дата начала не может быть раньше сегодняшнего дня", 400
        return (start_date, end_date), None, None

    period = resolve_month_period(month_value, year_value)
    if isinstance(period[0], str):
        return None, period[0], period[1]

    start_date, end_date = period
    return (max(start_date, today), end_date), None, None


def split_ticket_period_by_month(start_date: date, end_date: date) -> list[TicketPeriodSegment]:
    segments: list[TicketPeriodSegment] = []
    current_start = start_date

    while current_start <= end_date:
        month_last_day = monthrange(current_start.year, current_start.month)[1]
        month_end = date(current_start.year, current_start.month, month_last_day)
        current_end = min(month_end, end_date)
        segments.append(
            TicketPeriodSegment(
                month=current_start.month,
                year=current_start.year,
                start_date=current_start,
                end_date=current_end,
            )
        )
        current_start = current_end + timedelta(days=1)

    return segments


def format_ticket_period_segment(segment: TicketPeriodSegment) -> str:
    return f"{segment.month:02d}.{segment.year}"
