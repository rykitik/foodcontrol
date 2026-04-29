from __future__ import annotations

from calendar import monthrange
from collections import defaultdict
from datetime import date

from sqlalchemy.orm import joinedload

from app.models import Category, HolidayCalendar, MealRecord, Student, Ticket, db
from app.utils.official_holidays import ensure_official_holidays_for_years
from app.utils.report_generator import rubles_to_words, russian_month_name

from .context import AccountingDocumentContext
from .metadata import (
    ALL_CATEGORIES_GENITIVE_LABEL,
    ALL_CATEGORIES_NAME,
    ALL_CATEGORIES_TITLE_LABEL,
    FORM_METADATA,
    all_categories_meal_sheet_title,
    category_genitive_label,
    category_title_label,
    cost_calculation_category_line,
    cost_calculation_title,
    cost_statement_title,
    meal_sheet_title,
    meal_type_count_label,
    meal_type_label,
)
from .template_config import (
    ALL_ACCOUNTING_CATEGORY_CODE,
)

ALL_ACCOUNTING_CATEGORY_ID = 0


def month_period(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])
    return start, end


def _runtime_context_payload(context: AccountingDocumentContext) -> dict[str, str | date]:
    return {
        "prepared_by_full_name": context.prepared_by_full_name,
        "prepared_by_short_name": context.prepared_by_short_name,
        "generated_at": context.generated_at,
    }


def resolve_category(category_id: int) -> Category:
    category = db.session.get(Category, int(category_id))
    if category is None:
        raise LookupError("Категория не найдена")
    return category


def build_meal_sheet_payload(
    *,
    month: int,
    year: int,
    category_id: int,
    meal_type: str,
    context: AccountingDocumentContext,
    report_date: date | None = None,
) -> dict:
    period_start, period_end = month_period(year, month)
    category, scope_categories = _resolve_scope_categories(
        category_id,
        meal_type=meal_type,
        missing_template_error="Для выбранной категории этот прием пищи недоступен",
    )

    tickets = _load_category_tickets(month=month, year=year, category_ids=[item.id for item in scope_categories])
    rows_by_student = _build_student_rows(tickets)
    ticket_ids = [ticket.id for ticket in tickets]
    records = _load_meal_records(ticket_ids=ticket_ids, period_start=period_start, period_end=period_end, meal_type=meal_type)

    day_counts = {current.isoformat(): 0 for current in _iter_days(period_start, period_end)}
    day_amounts = {current.isoformat(): 0.0 for current in _iter_days(period_start, period_end)}
    total_count = 0
    total_amount = 0.0

    for record in records:
        row = rows_by_student.get(record.student_id)
        if row is None:
            continue

        day_key = record.issue_date.isoformat()
        row["marks"][day_key] = "X"
        row["total_count"] += 1
        row["total_amount"] += float(record.price or 0)
        day_counts[day_key] += 1
        day_amounts[day_key] += float(record.price or 0)
        total_count += 1
        total_amount += float(record.price or 0)

    rows = list(rows_by_student.values())
    for index, row in enumerate(rows, start=1):
        row["index"] = index
        row["total_amount"] = round(row["total_amount"], 2)

    scope_meta = _category_scope_metadata(category)
    meal_price = float(category.meal_prices.get(meal_type, 0) or 0) if category is not None else 0.0
    day_prices: dict[str, float | str] = {}
    for key in day_counts:
        if day_counts[key]:
            day_prices[key] = round((day_amounts[key] / day_counts[key]), 2)
        else:
            day_prices[key] = meal_price if category is not None else ""

    report_date_value = report_date or context.generated_at
    days = [
        {
            "date": current,
            "day": current.day,
            "iso": current.isoformat(),
        }
        for current in _iter_days(period_start, period_end)
    ]

    return {
        "document_type": "meal_sheet",
        "title": meal_sheet_title(category) if category is not None else all_categories_meal_sheet_title(),
        "subtitle": f"за {russian_month_name(period_start)} {year} г.",
        "month": month,
        "year": year,
        "category_id": scope_meta["category_id"],
        "category_code": scope_meta["category_code"],
        "category_name": scope_meta["category_name"],
        "category_label": scope_meta["category_label"],
        "category_genitive": scope_meta["category_genitive"],
        "meal_type": meal_type,
        "meal_type_label": meal_type_label(meal_type),
        "meal_type_count_label": meal_type_count_label(meal_type),
        "meal_price": meal_price,
        "period_start": period_start,
        "period_end": period_end,
        "days": days,
        "rows": rows,
        "day_counts": day_counts,
        "day_amounts": {key: round(value, 2) for key, value in day_amounts.items()},
        "day_prices": day_prices,
        "total_count": total_count,
        "total_amount": round(total_amount, 2),
        "report_date": report_date_value,
        "form_metadata": FORM_METADATA,
        **_runtime_context_payload(context),
    }


def build_cost_statement_payload(
    *,
    month: int,
    year: int,
    category_id: int,
    context: AccountingDocumentContext,
    report_date: date | None = None,
) -> dict:
    period_start, period_end = month_period(year, month)
    category, scope_categories = _resolve_scope_categories(category_id)
    tickets = _load_category_tickets(month=month, year=year, category_ids=[item.id for item in scope_categories])
    ticket_ids = [ticket.id for ticket in tickets]
    rows_by_student = _build_student_rows(tickets)
    records = _load_meal_records(ticket_ids=ticket_ids, period_start=period_start, period_end=period_end, meal_type=None)

    for record in records:
        row = rows_by_student.get(record.student_id)
        if row is None:
            continue
        row["total_amount"] += float(record.price or 0)

    rows = []
    grand_total = 0.0
    for row in rows_by_student.values():
        amount = round(row["total_amount"], 2)
        if amount <= 0:
            continue
        grand_total += amount
        rows.append(
            {
                "student_name": row["student_name"],
                "group_name": row["group_name"],
                "total_amount": amount,
            }
        )

    for index, row in enumerate(rows, start=1):
        row["index"] = index

    scope_meta = _category_scope_metadata(category)
    report_date_value = report_date or context.generated_at
    return {
        "document_type": "cost_statement",
        "title": cost_statement_title(),
        "subtitle": "стоимости предоставленного питания студентам колледжа",
        "month": month,
        "year": year,
        "period_start": period_start,
        "period_end": period_end,
        "category_id": scope_meta["category_id"],
        "category_code": scope_meta["category_code"],
        "category_name": scope_meta["category_name"],
        "category_label": scope_meta["category_label"],
        "category_genitive": scope_meta["category_genitive"],
        "rows": rows,
        "grand_total": round(grand_total, 2),
        "amount_words": rubles_to_words(grand_total),
        "report_date": report_date_value,
        "form_metadata": FORM_METADATA,
        **_runtime_context_payload(context),
    }


def build_cost_calculation_payload(
    *,
    month: int,
    year: int,
    category_id: int,
    context: AccountingDocumentContext,
) -> dict:
    period_start, period_end = month_period(year, month)
    category, scope_categories = _resolve_scope_categories(category_id)
    tickets = _load_category_tickets(month=month, year=year, category_ids=[item.id for item in scope_categories])
    ticket_ids = [ticket.id for ticket in tickets]
    rows_by_student = _build_student_rows(tickets)
    records = _load_meal_records(ticket_ids=ticket_ids, period_start=period_start, period_end=period_end, meal_type=None)

    for record in records:
        row = rows_by_student.get(record.student_id)
        if row is None:
            continue
        row["total_amount"] += float(record.price or 0)

    study_day_count = _service_day_count(period_start, period_end)
    rows = []
    total_meal_amount = 0.0
    for row in rows_by_student.values():
        meal_amount = round(row["total_amount"], 2)
        total_meal_amount += meal_amount
        rows.append(
            {
                "student_name": row["student_name"],
                "group_name": row["group_name"],
                "meal_amount": meal_amount,
                "note": "",
            }
        )

    for index, row in enumerate(rows, start=1):
        row["index"] = index

    scope_meta = _category_scope_metadata(category)
    return {
        "document_type": "cost_calculation",
        "title": cost_calculation_title(),
        "subtitle": f"за {russian_month_name(period_start)} {year} г.",
        "month": month,
        "year": year,
        "period_start": period_start,
        "period_end": period_end,
        "category_id": scope_meta["category_id"],
        "category_code": scope_meta["category_code"],
        "category_name": scope_meta["category_name"],
        "category_label": scope_meta["category_label"],
        "category_genitive": scope_meta["category_genitive"],
        "category_line": cost_calculation_category_line(category),
        "study_day_count": study_day_count,
        "rows": rows,
        "total_meal_amount": round(total_meal_amount, 2),
        "form_metadata": FORM_METADATA,
        **_runtime_context_payload(context),
    }


def _load_category_tickets(*, month: int, year: int, category_ids: list[int]) -> list[Ticket]:
    if not category_ids:
        return []

    return (
        Ticket.query.options(joinedload(Ticket.student).joinedload(Student.category))
        .filter(
            Ticket.month == int(month),
            Ticket.year == int(year),
            Ticket.category_id.in_([int(category_id) for category_id in category_ids]),
            Ticket.status != "cancelled",
        )
        .join(Student)
        .order_by(Student.full_name.asc(), Ticket.created_at.desc())
        .all()
    )


def _resolve_scope_categories(
    category_id: int,
    *,
    meal_type: str | None = None,
    missing_template_error: str | None = None,
) -> tuple[Category | None, list[Category]]:
    if int(category_id) == ALL_ACCOUNTING_CATEGORY_ID:
        categories = Category.query.order_by(Category.id.asc()).all()
        if meal_type is not None:
            categories = [category for category in categories if meal_type in category.meal_types]
        if not categories:
            raise ValueError(missing_template_error or "Для выбранного отбора нет доступных категорий")
        return None, categories

    category = resolve_category(category_id)
    if meal_type is not None and meal_type not in category.meal_types:
        raise ValueError(missing_template_error or "Для выбранной категории этот прием пищи недоступен")
    return category, [category]


def _category_scope_metadata(category: Category | None) -> dict[str, str | int]:
    if category is None:
        return {
            "category_id": ALL_ACCOUNTING_CATEGORY_ID,
            "category_code": ALL_ACCOUNTING_CATEGORY_CODE,
            "category_name": ALL_CATEGORIES_NAME,
            "category_label": ALL_CATEGORIES_TITLE_LABEL,
            "category_genitive": ALL_CATEGORIES_GENITIVE_LABEL,
        }

    return {
        "category_id": category.id,
        "category_code": category.code,
        "category_name": category.name,
        "category_label": category_title_label(category),
        "category_genitive": category_genitive_label(category),
    }


def _service_day_count(period_start: date, period_end: date) -> int:
    ensure_official_holidays_for_years({period_start.year, period_end.year})
    holiday_dates = {
        entry.holiday_date
        for entry in HolidayCalendar.query.filter(
            HolidayCalendar.is_active.is_(True),
            HolidayCalendar.holiday_date.between(period_start, period_end),
        ).all()
    }
    return sum(
        1
        for current in _iter_days(period_start, period_end)
        if current.weekday() != 6 and current not in holiday_dates
    )


def _load_meal_records(*, ticket_ids: list[str], period_start: date, period_end: date, meal_type: str | None) -> list[MealRecord]:
    if not ticket_ids:
        return []

    query = MealRecord.query.filter(
        MealRecord.ticket_id.in_(ticket_ids),
        MealRecord.issue_date.between(period_start, period_end),
    ).order_by(MealRecord.issue_date.asc(), MealRecord.student_id.asc())
    if meal_type is not None:
        query = query.filter(MealRecord.meal_type == meal_type)
    return query.all()


def _build_student_rows(tickets: list[Ticket]) -> dict[str, dict]:
    rows_by_student: dict[str, dict] = {}
    for ticket in tickets:
        if ticket.student_id in rows_by_student:
            continue
        rows_by_student[ticket.student_id] = {
            "student_id": ticket.student_id,
            "student_name": ticket.student.full_name,
            "group_name": ticket.student.group_name,
            "date_value": ticket.end_date,
            "marks": defaultdict(str),
            "total_count": 0,
            "total_amount": 0.0,
        }
    return rows_by_student


def _iter_days(period_start: date, period_end: date):
    current = period_start
    while current <= period_end:
        yield current
        current = date.fromordinal(current.toordinal() + 1)
