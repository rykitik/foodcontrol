from __future__ import annotations

from datetime import date, timedelta
from html import escape

from app.models import Category, MealRecord, Student, Ticket
from app.utils.report_generator import FORM_METADATA, format_russian_date, rubles_to_words, russian_month_name
from app.utils.student_access import assigned_to_meal_building_expr


def _meal_mark(meal_types: list[str]) -> str:
    marks = []
    if "breakfast" in meal_types:
        marks.append("xЗ")
    if "lunch" in meal_types:
        marks.append("xО")
    return "<br>".join(marks)


def _build_signature_line(label: str, name: str) -> str:
    return (
        "<div class='signature-line'>"
        f"<span>{escape(label)}</span>"
        "<span>________________</span>"
        f"<span>{escape(name)}</span>"
        "</div>"
    )


def _build_meal_sheet_matrix(period_start: date, period_end: date, category_id=None, building_id=None, ticket_status=None):
    days: list[date] = []
    current_day = period_start
    while current_day <= period_end:
        days.append(current_day)
        current_day += timedelta(days=1)

    rows_by_student: dict[str, dict] = {}
    category_names: set[str] = set()

    ticket_query = Ticket.query.join(Student).join(Category)
    ticket_query = ticket_query.filter(Ticket.start_date <= period_end, Ticket.end_date >= period_start)
    if category_id:
        ticket_query = ticket_query.filter(Category.id == int(category_id))
    if building_id:
        ticket_query = ticket_query.filter(assigned_to_meal_building_expr(int(building_id)))
    if ticket_status:
        ticket_query = ticket_query.filter(Ticket.status == ticket_status)

    for ticket in ticket_query.order_by(Student.full_name.asc(), Ticket.created_at.asc()).all():
        category_names.add(ticket.category.name)
        rows_by_student.setdefault(
            ticket.student_id,
            {
                "student_name": ticket.student.full_name,
                "group_name": ticket.student.group_name,
                "building_id": ticket.student.effective_meal_building_id,
                "category_name": ticket.category.name,
                "cells": {day.isoformat(): [] for day in days},
                "total_count": 0,
                "total_amount": 0.0,
            },
        )

    meal_query = MealRecord.query.join(Student).join(Category).join(Ticket, MealRecord.ticket_id == Ticket.id)
    meal_query = meal_query.filter(MealRecord.issue_date.between(period_start, period_end))
    if category_id:
        meal_query = meal_query.filter(Category.id == int(category_id))
    if building_id:
        meal_query = meal_query.filter(MealRecord.building_id == int(building_id))
    if ticket_status:
        meal_query = meal_query.filter(Ticket.status == ticket_status)

    day_totals = {day.isoformat(): {"count": 0, "amount": 0.0} for day in days}
    total_count = 0
    total_amount = 0.0

    for record in meal_query.order_by(Student.full_name.asc(), MealRecord.issue_date.asc()).all():
        category_names.add(record.student.category.name)
        row = rows_by_student.setdefault(
            record.student_id,
            {
                "student_name": record.student.full_name,
                "group_name": record.student.group_name,
                "building_id": record.building_id,
                "category_name": record.student.category.name,
                "cells": {day.isoformat(): [] for day in days},
                "total_count": 0,
                "total_amount": 0.0,
            },
        )
        row["cells"][record.issue_date.isoformat()].append(record.meal_type)
        row["total_count"] += 1
        row["total_amount"] += float(record.price or 0)
        day_totals[record.issue_date.isoformat()]["count"] += 1
        day_totals[record.issue_date.isoformat()]["amount"] += float(record.price or 0)
        total_count += 1
        total_amount += float(record.price or 0)

    category_name = next(iter(category_names)) if len(category_names) == 1 else "Все категории"
    building_name = f"Корпус {building_id}" if building_id else "Все корпуса"
    rows = sorted(rows_by_student.values(), key=lambda item: (item["student_name"], item["group_name"]))

    return {
        "days": days,
        "rows": rows,
        "day_totals": day_totals,
        "total_count": total_count,
        "total_amount": round(total_amount, 2),
        "amount_words": rubles_to_words(total_amount),
        "category_name": category_name,
        "building_name": building_name,
    }


def build_meal_sheet_document_payload(
    period_start: date,
    period_end: date,
    *,
    category_id=None,
    building_id=None,
    ticket_status=None,
    report_date: date | None = None,
    author_name: str | None = None,
    include_reviewer: bool = True,
):
    data = _build_meal_sheet_matrix(
        period_start,
        period_end,
        category_id=category_id,
        building_id=building_id,
        ticket_status=ticket_status,
    )
    report_day = report_date or date.today()
    day_headers = "".join(f"<th class='day-col'>{day.day}</th>" for day in data["days"])
    day_colgroup = "".join("<col class='social-meal-sheet-day-column'>" for _ in data["days"])
    rows_html = "".join(
        f"""
        <tr>
          <td>{index}</td>
          <td class="student-col">
            {escape(row["student_name"])}<br><span>{escape(row["group_name"])}</span>
          </td>
          {''.join(f"<td class='day-cell'>{_meal_mark(row['cells'][day.isoformat()])}</td>" for day in data["days"])}
          <td>{row["total_count"]}</td>
          <td>{row["total_amount"]:.2f}</td>
        </tr>
        """
        for index, row in enumerate(data["rows"], start=1)
    )
    totals_count_row = "".join(f"<td class='day-total'>{data['day_totals'][day.isoformat()]['count']}</td>" for day in data["days"])
    totals_amount_row = "".join(f"<td class='day-total'>{data['day_totals'][day.isoformat()]['amount']:.2f}</td>" for day in data["days"])
    colspan = len(data["days"]) + 4
    resolved_author_name = author_name or FORM_METADATA["accountant_name"]
    signatures = [_build_signature_line("Составил", resolved_author_name)]
    if include_reviewer:
        signatures.append(_build_signature_line("Проверил", FORM_METADATA["chief_accountant_name"]))
    signatures_html = "".join(signatures)

    html = f"""
    <section class="report-page social-print-page social-meal-sheet-page">
      <div class="doc-title">Итоговая ведомость питания</div>
      <div class="doc-subtitle">за {russian_month_name(period_start)} {period_start.year} г.</div>
      <div class="doc-org">{FORM_METADATA['institution']}</div>
      <div class="doc-inline-meta">
        <span>{escape(data['building_name'])}</span>
        <span>Категория: {escape(data['category_name'])}</span>
        <span>Дата составления: {format_russian_date(report_day)}</span>
      </div>
      <table class="report-table report-table-wide social-meal-sheet-table">
        <colgroup>
          <col class="social-meal-sheet-index-column">
          <col class="social-meal-sheet-student-column">
          {day_colgroup}
          <col class="social-meal-sheet-total-column">
          <col class="social-meal-sheet-amount-column">
        </colgroup>
        <thead>
          <tr>
            <th>№</th>
            <th>Фамилия И.О., группа</th>
            {day_headers}
            <th>Итого</th>
            <th>Сумма</th>
          </tr>
        </thead>
        <tbody>
          {rows_html or f'<tr><td colspan="{colspan}">За выбранный период нет талонов и выдач.</td></tr>'}
          <tr class="totals-row">
            <td colspan="2">Количество приемов пищи</td>
            {totals_count_row}
            <td>{data['total_count']}</td>
            <td></td>
          </tr>
          <tr class="totals-row">
            <td colspan="2">Сумма питания</td>
            {totals_amount_row}
            <td></td>
            <td>{data['total_amount']:.2f}</td>
          </tr>
        </tbody>
      </table>
      <footer class="report-footer">
        <div class="totals">Сумма прописью: {escape(data['amount_words'])}</div>
        <div class="signatures">
          {signatures_html}
        </div>
      </footer>
    </section>
    """
    return {
        "title": "Итоговая ведомость питания",
        "subtitle": f"Период: {format_russian_date(period_start)} - {format_russian_date(period_end)}",
        "html": html,
        "page_orientation": "landscape",
    }
