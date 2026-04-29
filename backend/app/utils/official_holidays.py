from __future__ import annotations

from datetime import date

from app.models import HolidayCalendar, db
from sqlalchemy.exc import IntegrityError

OFFICIAL_COLLEGE_HOLIDAYS: tuple[tuple[int, int, str], ...] = (
    (1, 1, "Новогодние каникулы"),
    (1, 2, "Новогодние каникулы"),
    (1, 3, "Новогодние каникулы"),
    (1, 4, "Новогодние каникулы"),
    (1, 5, "Новогодние каникулы"),
    (1, 6, "Новогодние каникулы"),
    (1, 7, "Рождество Христово"),
    (1, 8, "Новогодние каникулы"),
    (2, 23, "День защитника Отечества"),
    (3, 8, "Международный женский день"),
    (5, 1, "Праздник Весны и Труда"),
    (5, 9, "День Победы"),
    (6, 12, "День России"),
    (11, 4, "День народного единства"),
)


def iter_official_holidays_for_year(year: int) -> list[tuple[date, str]]:
    return [(date(year, month, day), title) for month, day, title in OFFICIAL_COLLEGE_HOLIDAYS]


def ensure_official_holidays_for_years(years: set[int] | list[int] | tuple[int, ...]) -> None:
    normalized_years = sorted({int(year) for year in years if int(year) >= 2000})
    if not normalized_years:
        return

    start_bound = date(normalized_years[0], 1, 1)
    end_bound = date(normalized_years[-1], 12, 31)
    existing_dates = {
        entry.holiday_date
        for entry in HolidayCalendar.query.filter(
            HolidayCalendar.holiday_date >= start_bound,
            HolidayCalendar.holiday_date <= end_bound,
        ).all()
    }

    missing_entries: list[HolidayCalendar] = []
    for year in normalized_years:
        for holiday_date, title in iter_official_holidays_for_year(year):
            if holiday_date in existing_dates:
                continue
            missing_entries.append(
                HolidayCalendar(
                    holiday_date=holiday_date,
                    title=title,
                    is_active=True,
                    created_by=None,
                )
            )

    if not missing_entries:
        return

    db.session.add_all(missing_entries)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
