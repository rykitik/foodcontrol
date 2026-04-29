from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from app.models import HolidayCalendar, db
from app.utils.official_holidays import ensure_official_holidays_for_years


@dataclass(frozen=True)
class HolidayRangeCreateResult:
    created_entries: list[HolidayCalendar]
    skipped_dates: list[date]


def parse_holiday_date(value: str | None, field_name: str) -> tuple[date | None, str | None]:
    if not value:
        return None, f"Не заполнено поле {field_name}"

    try:
        return date.fromisoformat(value), None
    except ValueError:
        return None, f"Некорректная дата в поле {field_name}, нужен YYYY-MM-DD"


def validate_holiday_range(start_date: date, end_date: date) -> str | None:
    if end_date < start_date:
        return "Дата окончания диапазона не может быть раньше даты начала"
    return None


def normalize_holiday_title(value: str | None) -> str | None:
    return (value or "").strip() or None


def create_holiday_entry(*, holiday_date: date, title: str | None, is_active: bool, created_by: str | None):
    ensure_official_holidays_for_years({holiday_date.year})

    existing = HolidayCalendar.query.filter_by(holiday_date=holiday_date).first()
    if existing:
        return None, "Для этой даты запись уже существует"

    entry = HolidayCalendar(
        holiday_date=holiday_date,
        title=normalize_holiday_title(title),
        is_active=is_active,
        created_by=created_by,
    )
    db.session.add(entry)
    return entry, None


def create_holiday_range(
    *,
    start_date: date,
    end_date: date,
    title: str | None,
    is_active: bool,
    created_by: str | None,
) -> HolidayRangeCreateResult:
    years = set(range(start_date.year, end_date.year + 1))
    ensure_official_holidays_for_years(years)

    existing_dates = {
        entry.holiday_date
        for entry in HolidayCalendar.query.filter(
            HolidayCalendar.holiday_date >= start_date,
            HolidayCalendar.holiday_date <= end_date,
        ).all()
    }

    normalized_title = normalize_holiday_title(title)
    created_entries: list[HolidayCalendar] = []
    skipped_dates: list[date] = []
    current_date = start_date

    while current_date <= end_date:
        if current_date in existing_dates:
            skipped_dates.append(current_date)
            current_date += timedelta(days=1)
            continue

        entry = HolidayCalendar(
            holiday_date=current_date,
            title=normalized_title,
            is_active=is_active,
            created_by=created_by,
        )
        db.session.add(entry)
        created_entries.append(entry)
        current_date += timedelta(days=1)

    return HolidayRangeCreateResult(created_entries=created_entries, skipped_dates=skipped_dates)
