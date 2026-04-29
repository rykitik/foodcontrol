from __future__ import annotations

from calendar import monthrange
from datetime import date


def normalize_period(start_value, end_value):
    if not start_value or not end_value:
        return ("Нужны start_date и end_date", 400)

    try:
        start_date = date.fromisoformat(start_value)
        end_date = date.fromisoformat(end_value)
    except ValueError:
        return ("Некорректный формат даты, нужен YYYY-MM-DD", 400)

    if end_date < start_date:
        return ("Дата окончания не может быть раньше даты начала", 400)

    return start_date, end_date


def validate_month_year_for_period(start_date: date, end_date: date, month: int | None, year: int | None):
    if month is None or year is None:
        return None

    if start_date.month != month or start_date.year != year:
        return ("Месяц и год должны совпадать с датой начала периода", 400)

    if end_date.month != start_date.month or end_date.year != start_date.year:
        return ("Период талона должен находиться в пределах одного месяца", 400)

    return None


def resolve_month_period(month_value, year_value):
    if month_value is None or year_value is None:
        return ("Нужны month и year", 400)

    try:
        month = int(month_value)
        year = int(year_value)
    except (TypeError, ValueError):
        return ("Месяц и год должны быть числами", 400)

    if month < 1 or month > 12:
        return ("Месяц должен быть в диапазоне от 1 до 12", 400)
    if year < 2000 or year > 2100:
        return ("Год должен быть в диапазоне от 2000 до 2100", 400)

    last_day = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def validate_not_past_month(month: int, year: int):
    today = date.today()
    if (year, month) < (today.year, today.month):
        return ("Нельзя выпускать талоны за прошедшие месяцы", 400)
    return None
