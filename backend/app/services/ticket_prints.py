from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from html import escape
from typing import Literal

from app.models import Student, Ticket
from app.utils.barcodes import render_code128_svg
from app.utils.report_generator import format_russian_date, russian_month_name
from app.utils.student_access import assigned_to_meal_building_expr
from app.utils.ticket_codes import build_ticket_meal_code, ensure_ticket_scan_code

TicketPrintSize = Literal["compact", "large"]


@dataclass(frozen=True)
class TicketPrintVariant:
    label: str
    meals: tuple[str, ...]
    code: str


@dataclass(frozen=True)
class TicketPrintCard:
    ticket: Ticket
    variant: TicketPrintVariant
    position: int
    total: int


def query_month_tickets(
    month: int,
    year: int,
    *,
    building_id: int | None = None,
    category_id: int | None = None,
    include_cancelled: bool = False,
    statuses: list[str] | None = None,
):
    query = Ticket.query.join(Student).filter(Ticket.month == month, Ticket.year == year)

    if building_id:
        query = query.filter(assigned_to_meal_building_expr(building_id))
    if category_id:
        query = query.filter(Student.category_id == category_id)
    if statuses:
        query = query.filter(Ticket.status.in_(statuses))
    if not include_cancelled:
        query = query.filter(Ticket.status != "cancelled")

    return query.order_by(Student.full_name.asc(), Student.group_name.asc()).all()


def short_student_name(full_name: str) -> str:
    parts = [part for part in full_name.split() if part]
    if len(parts) < 2:
        return full_name

    surname = parts[0]
    initials = " ".join(f"{part[0]}." for part in parts[1:] if part)
    return f"{surname} {initials}".strip()


def _meal_label(meal_type: str) -> str:
    return {"breakfast": "ЗАВТРАК", "lunch": "ОБЕД"}.get(meal_type, meal_type.upper())


def _format_money(value) -> str:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return ""

    if amount == amount.to_integral_value():
        return f"{int(amount)} ₽"
    return f"{amount.quantize(Decimal('0.01')):.2f}".replace(".", ",") + " ₽"


def _meal_amount_label(ticket: Ticket, meal_type: str) -> str:
    price = ticket.category.meal_prices.get(meal_type)
    return _format_money(price) if price is not None else _meal_label(meal_type)


def _variant_price_label(ticket: Ticket, meals: tuple[str, ...]) -> str:
    if not meals:
        return "Питание"
    return " + ".join(_meal_amount_label(ticket, meal_type) for meal_type in meals)


def iter_ticket_print_variants(ticket: Ticket) -> list[TicketPrintVariant]:
    base_code = ensure_ticket_scan_code(ticket)
    meal_types = tuple(meal_type for meal_type in ("breakfast", "lunch") if meal_type in ticket.category.meal_types)

    if meal_types == ("breakfast", "lunch"):
        variants = [
            ("ЗАВТРАК + ОБЕД", ("breakfast", "lunch")),
            ("ЗАВТРАК", ("breakfast",)),
            ("ОБЕД", ("lunch",)),
        ]
    elif meal_types == ("breakfast",):
        variants = [("ЗАВТРАК", ("breakfast",))]
    elif meal_types == ("lunch",):
        variants = [("ОБЕД", ("lunch",))]
    else:
        variants = [("ПИТАНИЕ", tuple())]

    return [
        TicketPrintVariant(
            label=label,
            meals=meals,
            code=build_ticket_meal_code(base_code, meals),
        )
        for label, meals in variants
    ]


def build_ticket_print_cards(ticket: Ticket) -> list[TicketPrintCard]:
    variants = iter_ticket_print_variants(ticket)
    total = len(variants)
    return [
        TicketPrintCard(ticket=ticket, variant=variant, position=index, total=total)
        for index, variant in enumerate(variants, start=1)
    ]


def build_ticket_receipt_sheet_document(
    *,
    month: int,
    year: int,
    tickets: list[Ticket],
    building_name: str,
):
    month_name = russian_month_name(tickets[0].start_date) if tickets else russian_month_name(date(year, month, 1))
    rows_html = "".join(
        f"""
        <tr>
          <td>{index}</td>
          <td>{escape(ticket.student.full_name)}</td>
          <td>{escape(ticket.student.group_name)}</td>
          <td>{escape(ticket.category.name)}</td>
          <td>{ticket.id[:8].upper()}</td>
          <td></td>
        </tr>
        """
        for index, ticket in enumerate(tickets, start=1)
    )

    html = f"""
    <section class="report-page social-print-page">
      <div class="doc-title">Ведомость получения талонов</div>
      <div class="doc-subtitle">за {month_name} {year} г.</div>
      <div class="doc-inline-meta">
        <span>{escape(building_name)}</span>
        <span>Всего талонов: {len(tickets)}</span>
      </div>
      <table class="report-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Фамилия, имя, отчество</th>
            <th>Группа</th>
            <th>Категория</th>
            <th>Талон</th>
            <th>Подпись в получении</th>
          </tr>
        </thead>
        <tbody>
          {rows_html or '<tr><td colspan="6">На выбранный месяц талоны не выпущены.</td></tr>'}
        </tbody>
      </table>
    </section>
    """
    return {
        "title": "Ведомость получения талонов",
        "subtitle": f"{month_name} {year} • {building_name}",
        "html": html,
    }


def _render_ticket_person(ticket: Ticket) -> str:
    return f"""
    <div class="ticket-print-person">
      <div class="ticket-print-student">{escape(ticket.student.full_name)}</div>
      <div class="ticket-print-group">{escape(ticket.student.group_name)}</div>
    </div>
    """


def _render_ticket_card_position(card: TicketPrintCard) -> str:
    return f'<div class="ticket-print-card-sequence">{card.position} из {card.total}</div>'


def _build_ticket_barcode_payload(ticket: Ticket, scan_code: str) -> str:
    period_code = f"{ticket.start_date:%Y%m%d}{ticket.end_date:%Y%m%d}"
    ticket_code = ticket.id.replace("-", "").upper()[:10]
    return f"{scan_code}-P{period_code}-T{ticket_code}"


def _render_ticket_card(card: TicketPrintCard, *, print_size: TicketPrintSize) -> str:
    ticket = card.ticket
    variant = card.variant
    price_text = _variant_price_label(ticket, variant.meals)
    period_text = f"{format_russian_date(ticket.start_date)} — {format_russian_date(ticket.end_date)}"
    barcode_payload = _build_ticket_barcode_payload(ticket, variant.code)
    return f"""
    <article class="ticket-print-card ticket-print-card-detachable {'ticket-print-card--large' if print_size == 'large' else ''}">
      <div class="ticket-print-card-head">
        <div>
          <div class="ticket-print-card-title">{escape(variant.label)}</div>
          <div class="ticket-print-card-price">{escape(price_text)}</div>
        </div>
        {_render_ticket_card_position(card)}
      </div>
      {_render_ticket_person(ticket)}
      <div class="ticket-print-barcode-wrap">
        <div class="ticket-print-barcode ticket-print-barcode-single" data-scan-code="{escape(variant.code, quote=True)}" data-barcode-payload="{escape(barcode_payload, quote=True)}">
          {render_code128_svg(barcode_payload)}
        </div>
      </div>
      <div class="ticket-print-period">{escape(period_text)}</div>
    </article>
    """


def _render_ticket_grid(cards: list[TicketPrintCard], *, print_size: TicketPrintSize) -> str:
    rows = []
    for index in range(0, len(cards), 2):
        left_card = _render_ticket_card(cards[index], print_size=print_size)
        right_card = _render_ticket_card(cards[index + 1], print_size=print_size) if index + 1 < len(cards) else ""
        empty_class = " ticket-print-cell--empty" if not right_card else ""
        rows.append(
            f"""
            <tr class="ticket-print-row">
              <td class="ticket-print-cell">{left_card}</td>
              <td class="ticket-print-cell{empty_class}">{right_card}</td>
            </tr>
            """
        )

    return f"""
    <table class="ticket-print-grid {'ticket-print-grid--large' if print_size == 'large' else 'ticket-print-grid--compact'}">
      <tbody>
        {''.join(rows)}
      </tbody>
    </table>
    """


def _render_ticket_sheet_header(*, month_name: str, year: int, total_students: int, total_cards: int) -> str:
    return f"""
    <header class="ticket-sheet-header">
      <div>
        <h1 class="ticket-sheet-title">Лист талонов на питание</h1>
        <p class="ticket-sheet-period">{escape(month_name)} {year}</p>
      </div>
      <div class="ticket-sheet-stats">
        <span>Студентов: {total_students}</span>
        <span>Талонов: {total_cards}</span>
      </div>
    </header>
    """


def build_ticket_sheet_document(
    *,
    month: int,
    year: int,
    tickets: list[Ticket],
    print_size: TicketPrintSize = "compact",
):
    month_name = russian_month_name(tickets[0].start_date) if tickets else russian_month_name(date(year, month, 1))
    cards = [card for ticket in tickets for card in build_ticket_print_cards(ticket)]
    total_cards = len(cards)
    total_students = len({ticket.student_id for ticket in tickets})
    content_html = (
        _render_ticket_grid(cards, print_size=print_size)
        if cards
        else '<div class="ticket-print-empty">На выбранный месяц нет активных талонов для печати.</div>'
    )

    html = f"""
    <section class="report-page ticket-sheet-page">
      {_render_ticket_sheet_header(month_name=month_name, year=year, total_students=total_students, total_cards=total_cards)}
      {content_html}
    </section>
    """
    return {
        "title": "Лист талонов на питание",
        "subtitle": f"{month_name} {year}",
        "html": html,
    }
