from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta

from app.models import MealRecord, Student, User
from app.serializers import building_name
from app.utils.buildings import known_building_ids

MEAL_TYPE_LABELS = {
    "breakfast": "Завтрак",
    "lunch": "Обед",
}

MEAL_TYPE_ORDER = {
    "breakfast": 0,
    "lunch": 1,
}


def _line_item_sort_key(item: dict) -> tuple[int, float]:
    return (MEAL_TYPE_ORDER.get(str(item["meal_type"]), 99), float(item["price"]))


def _round_amount(value: float) -> float:
    return round(value, 2)


def _build_known_building_ids() -> list[int]:
    building_ids: set[int] = set(known_building_ids())

    sources = (
        Student.query.with_entities(Student.building_id).distinct().all(),
        Student.query.with_entities(Student.meal_building_id).distinct().all(),
        User.query.with_entities(User.building_id).distinct().all(),
        MealRecord.query.with_entities(MealRecord.building_id).distinct().all(),
    )

    for rows in sources:
        for (value,) in rows:
            if value:
                building_ids.add(int(value))

    return sorted(building_ids)


def _build_line_items(records: list[MealRecord]) -> list[dict]:
    items: dict[tuple[str, float], dict] = {}

    for record in records:
        meal_type = str(record.meal_type)
        price = _round_amount(float(record.price or 0))
        key = (meal_type, price)
        current = items.get(
            key,
            {
                "meal_type": meal_type,
                "meal_type_label": MEAL_TYPE_LABELS.get(meal_type, meal_type),
                "price": price,
                "count": 0,
                "amount": 0.0,
            },
        )
        current["count"] += 1
        current["amount"] = _round_amount(float(current["amount"]) + price)
        items[key] = current

    return sorted(items.values(), key=_line_item_sort_key)


def _build_overview(records: list[MealRecord]) -> dict:
    breakfast_count = 0
    lunch_count = 0
    amount = 0.0

    for record in records:
        if record.meal_type == "breakfast":
            breakfast_count += 1
        if record.meal_type == "lunch":
            lunch_count += 1
        amount += float(record.price or 0)

    return {
        "count": len(records),
        "breakfast_count": breakfast_count,
        "lunch_count": lunch_count,
        "amount": _round_amount(amount),
    }


def _build_daily_rows(*, records: list[MealRecord], period_start: date, period_end: date) -> list[dict]:
    grouped: dict[date, dict[str, float | int | str]] = {}

    current_date = period_end
    while current_date >= period_start:
        grouped[current_date] = {
            "issue_date": current_date.isoformat(),
            "count": 0,
            "breakfast_count": 0,
            "lunch_count": 0,
            "amount": 0.0,
        }
        current_date -= timedelta(days=1)

    for record in records:
        row = grouped.get(record.issue_date)
        if row is None:
            continue
        row["count"] = int(row["count"]) + 1
        row["amount"] = _round_amount(float(row["amount"]) + float(record.price or 0))
        if record.meal_type == "breakfast":
            row["breakfast_count"] = int(row["breakfast_count"]) + 1
        if record.meal_type == "lunch":
            row["lunch_count"] = int(row["lunch_count"]) + 1

    rows: list[dict] = []
    current_date = period_end
    while current_date >= period_start:
        rows.append(grouped[current_date])
        current_date -= timedelta(days=1)
    return rows


def _build_buildings_table(records: list[MealRecord], building_ids: list[int]) -> dict:
    records_by_building: dict[int, list[MealRecord]] = {building_id: [] for building_id in building_ids}
    for record in records:
        records_by_building.setdefault(int(record.building_id), []).append(record)

    rows = []
    for building_id in building_ids:
        building_records = records_by_building.get(building_id, [])
        rows.append(
            {
                "building_id": building_id,
                "building_name": building_name(building_id) or f"Корпус {building_id}",
                "line_items": _build_line_items(building_records),
                "total_count": len(building_records),
                "total_amount": _round_amount(sum(float(record.price or 0) for record in building_records)),
            }
        )

    return {
        "rows": rows,
        "totals": {
            "line_items": _build_line_items(records),
            "total_count": len(records),
            "total_amount": _round_amount(sum(float(record.price or 0) for record in records)),
        },
    }


def resolve_cashier_summary_period(
    *,
    days: int,
    month: int | None = None,
    year: int | None = None,
    period_end: date | None = None,
) -> tuple[date, date, dict]:
    if month is None and year is None:
        resolved_period_end = period_end or date.today()
        resolved_period_start = resolved_period_end - timedelta(days=days - 1)
        return resolved_period_start, resolved_period_end, {
            "mode": "days",
            "days": days,
            "month": None,
            "year": None,
        }

    if month is None or year is None:
        raise ValueError("Для месячной сводки нужны month и year")
    if month < 1 or month > 12:
        raise ValueError("Месяц должен быть в диапазоне 1-12")

    month_days = monthrange(year, month)[1]
    resolved_period_start = date(year, month, 1)
    resolved_period_end = date(year, month, month_days)
    return resolved_period_start, resolved_period_end, {
        "mode": "month",
        "days": None,
        "month": month,
        "year": year,
    }


def build_cashier_daily_summary(
    *,
    days: int,
    history_building_id: int | None,
    month: int | None = None,
    year: int | None = None,
    period_end: date | None = None,
) -> dict:
    period_start, resolved_period_end, filter_meta = resolve_cashier_summary_period(
        days=days,
        month=month,
        year=year,
        period_end=period_end,
    )
    period_days = (resolved_period_end - period_start).days + 1
    records = (
        MealRecord.query.filter(MealRecord.issue_date.between(period_start, resolved_period_end))
        .order_by(MealRecord.issue_date.desc(), MealRecord.issue_time.desc())
        .all()
    )

    history_records = (
        [record for record in records if int(record.building_id) == int(history_building_id)]
        if history_building_id
        else list(records)
    )
    known_building_ids = _build_known_building_ids()

    return {
        "days": period_days,
        "period_start": period_start.isoformat(),
        "period_end": resolved_period_end.isoformat(),
        "filter": filter_meta,
        "scope": {
            "history_building_id": history_building_id,
            "history_building_name": building_name(history_building_id),
            "history_scope_label": building_name(history_building_id) or "Все корпуса",
        },
        "overview": {
            "history_scope": _build_overview(history_records),
            "all_buildings": _build_overview(records),
        },
        "daily_rows": _build_daily_rows(
            records=history_records,
            period_start=period_start,
            period_end=resolved_period_end,
        ),
        "buildings_table": _build_buildings_table(records, known_building_ids),
    }
