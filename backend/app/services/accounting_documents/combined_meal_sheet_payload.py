from __future__ import annotations

from collections import defaultdict
from datetime import date

from app.models import Category
from app.utils.report_generator import russian_month_name

from .context import AccountingDocumentContext
from .metadata import FORM_METADATA, combined_meal_sheet_title
from .payloads import (
    ALL_ACCOUNTING_CATEGORY_ID,
    _build_student_rows,
    _category_scope_metadata,
    _iter_days,
    _load_category_tickets,
    _load_meal_records,
    _runtime_context_payload,
    month_period,
    resolve_category,
)

COMBINED_MEAL_TYPES = ("breakfast", "lunch")


def build_combined_meal_sheet_payload(
    *,
    month: int,
    year: int,
    category_id: int,
    context: AccountingDocumentContext,
    report_date: date | None = None,
) -> dict:
    period_start, period_end = month_period(year, month)
    category, scope_categories = _resolve_combined_meal_scope_categories(category_id)

    tickets = _load_category_tickets(month=month, year=year, category_ids=[item.id for item in scope_categories])
    rows_by_student = _build_student_rows(tickets)
    ticket_ids = [ticket.id for ticket in tickets]
    records = _load_meal_records(ticket_ids=ticket_ids, period_start=period_start, period_end=period_end, meal_type=None)

    day_totals = {
        current.isoformat(): {
            "breakfast": {"count": 0, "amount": 0.0},
            "lunch": {"count": 0, "amount": 0.0},
            "count": 0,
            "amount": 0.0,
        }
        for current in _iter_days(period_start, period_end)
    }
    meal_totals = {
        "breakfast": {"count": 0, "amount": 0.0},
        "lunch": {"count": 0, "amount": 0.0},
    }

    for row in rows_by_student.values():
        row["combined_marks"] = defaultdict(set)
        row["meal_counts"] = {"breakfast": 0, "lunch": 0}
        row["meal_amounts"] = {"breakfast": 0.0, "lunch": 0.0}

    for record in records:
        if record.meal_type not in COMBINED_MEAL_TYPES:
            continue

        row = rows_by_student.get(record.student_id)
        if row is None:
            continue

        day_key = record.issue_date.isoformat()
        amount = float(record.price or 0)
        row["combined_marks"][day_key].add(record.meal_type)
        row["meal_counts"][record.meal_type] += 1
        row["meal_amounts"][record.meal_type] += amount
        row["total_count"] += 1
        row["total_amount"] += amount

        day_totals[day_key][record.meal_type]["count"] += 1
        day_totals[day_key][record.meal_type]["amount"] += amount
        day_totals[day_key]["count"] += 1
        day_totals[day_key]["amount"] += amount
        meal_totals[record.meal_type]["count"] += 1
        meal_totals[record.meal_type]["amount"] += amount

    rows = []
    for index, row in enumerate(rows_by_student.values(), start=1):
        rows.append(
            {
                "index": index,
                "student_name": row["student_name"],
                "group_name": row["group_name"],
                "category_name": row["category_name"],
                "marks": {
                    day_key: _combined_meal_mark(meal_types)
                    for day_key, meal_types in row["combined_marks"].items()
                    if meal_types
                },
                "breakfast_count": row["meal_counts"]["breakfast"],
                "lunch_count": row["meal_counts"]["lunch"],
                "breakfast_amount": round(row["meal_amounts"]["breakfast"], 2),
                "lunch_amount": round(row["meal_amounts"]["lunch"], 2),
                "total_count": row["total_count"],
                "total_amount": round(row["total_amount"], 2),
            }
        )

    _round_total_amounts(day_totals, meal_totals)
    scope_meta = _category_scope_metadata(category)
    days = [
        {
            "date": current,
            "day": current.day,
            "iso": current.isoformat(),
        }
        for current in _iter_days(period_start, period_end)
    ]
    total_amount = meal_totals["breakfast"]["amount"] + meal_totals["lunch"]["amount"]

    return {
        "document_type": "combined_meal_sheet",
        "title": combined_meal_sheet_title(category),
        "subtitle": f"за {russian_month_name(period_start)} {year} г.",
        "month": month,
        "year": year,
        "category_id": scope_meta["category_id"],
        "category_code": scope_meta["category_code"],
        "category_name": scope_meta["category_name"],
        "category_label": scope_meta["category_label"],
        "category_genitive": scope_meta["category_genitive"],
        "period_start": period_start,
        "period_end": period_end,
        "days": days,
        "rows": rows,
        "day_totals": day_totals,
        "meal_totals": meal_totals,
        "total_count": meal_totals["breakfast"]["count"] + meal_totals["lunch"]["count"],
        "total_amount": round(total_amount, 2),
        "report_date": report_date or context.generated_at,
        "form_metadata": FORM_METADATA,
        **_runtime_context_payload(context),
    }


def _resolve_combined_meal_scope_categories(category_id: int) -> tuple[Category | None, list[Category]]:
    if int(category_id) == ALL_ACCOUNTING_CATEGORY_ID:
        categories = [
            category
            for category in Category.query.order_by(Category.id.asc()).all()
            if any(meal_type in category.meal_types for meal_type in COMBINED_MEAL_TYPES)
        ]
        if not categories:
            raise ValueError("Для выбранного отбора нет категорий с завтраком или обедом")
        return None, categories

    category = resolve_category(category_id)
    if not any(meal_type in category.meal_types for meal_type in COMBINED_MEAL_TYPES):
        raise ValueError("Для выбранной категории недоступны завтрак или обед")
    return category, [category]


def _round_total_amounts(day_totals: dict, meal_totals: dict) -> None:
    for meal_type in COMBINED_MEAL_TYPES:
        meal_totals[meal_type]["amount"] = round(meal_totals[meal_type]["amount"], 2)

    for day_payload in day_totals.values():
        day_payload["breakfast"]["amount"] = round(day_payload["breakfast"]["amount"], 2)
        day_payload["lunch"]["amount"] = round(day_payload["lunch"]["amount"], 2)
        day_payload["amount"] = round(day_payload["amount"], 2)


def _combined_meal_mark(meal_types: set[str]) -> str:
    has_breakfast = "breakfast" in meal_types
    has_lunch = "lunch" in meal_types
    if has_breakfast and has_lunch:
        return "З/О"
    if has_breakfast:
        return "З"
    if has_lunch:
        return "О"
    return ""
