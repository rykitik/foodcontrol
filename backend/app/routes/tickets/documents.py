from __future__ import annotations

from datetime import date
from io import BytesIO

from flask import jsonify, request, send_file

from app.auth import login_required
from app.models import Student, Ticket, db
from app.routes.tickets import tickets_bp
from app.routes.tickets.shared import (
    apply_ticket_scope,
    ensure_ticket_access,
    resolve_document_filters,
    resolve_ticket_print_size,
    resolve_ticket_period,
)
from app.serializer_state import serialize_tickets
from app.services.ticket_prints import (
    build_ticket_receipt_sheet_document,
    build_ticket_sheet_document,
    query_month_tickets,
)
from app.services.ticket_statuses import sync_ticket_statuses
from app.utils.audit import log_action
from app.utils.report_generator import build_ticket_journal_workbook


def _build_document_building_name(building_id: int | None) -> str:
    return f"Корпус {building_id}" if building_id else "Все корпуса"


@tickets_bp.get("/export/xlsx")
@login_required(roles=["social", "head_social", "admin", "accountant"])
def export_tickets_xlsx(current_user):
    sync_ticket_statuses()
    building_id = request.args.get("building_id", type=int)
    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)
    status = request.args.get("status")
    category_id = request.args.get("category_id", type=int)
    attention_only = request.args.get("attention_only", type=int) == 1

    query = Ticket.query.join(Student)
    query = apply_ticket_scope(query, current_user, building_id)
    if month:
        query = query.filter(Ticket.month == month)
    if year:
        query = query.filter(Ticket.year == year)
    if status:
        query = query.filter(Ticket.status == status)
    if category_id:
        query = query.filter(Ticket.category_id == category_id)

    rows = serialize_tickets(query.order_by(Ticket.created_at.desc()).all())
    if attention_only:
        rows = [row for row in rows if row["requires_attention"]]

    file_month = month or date.today().month
    file_year = year or date.today().year
    workbook_bytes = build_ticket_journal_workbook(rows, file_month, file_year)
    log_action(
        current_user,
        "export_ticket_journal_xlsx",
        "ticket_export",
        None,
        {
            "building_id": building_id,
            "category_id": category_id,
            "month": file_month,
            "year": file_year,
            "rows": len(rows),
        },
    )
    return send_file(
        BytesIO(workbook_bytes),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"ticket-journal-{file_year}-{file_month:02d}.xlsx",
    )


@tickets_bp.post("/receipt-sheet/document")
@login_required(roles=["social", "head_social", "admin"])
def ticket_receipt_sheet_document(current_user):
    sync_ticket_statuses()
    payload = request.get_json(silent=True) or {}
    period, error_response, status_code = resolve_ticket_period(payload.get("month"), payload.get("year"))
    if error_response:
        return error_response, status_code
    start_date, _end_date = period

    building_id, category_id, access_error = resolve_document_filters(current_user, payload)
    if access_error:
        return access_error

    tickets = query_month_tickets(
        start_date.month,
        start_date.year,
        building_id=building_id,
        category_id=category_id,
        statuses=["active"],
    )
    document = build_ticket_receipt_sheet_document(
        month=start_date.month,
        year=start_date.year,
        tickets=tickets,
        building_name=_build_document_building_name(building_id),
    )
    log_action(
        current_user,
        "print_ticket_receipt_sheet",
        "ticket_batch",
        None,
        {"month": start_date.month, "year": start_date.year, "building_id": building_id, "category_id": category_id},
    )
    return jsonify({"data": document})


@tickets_bp.post("/print-sheet/document")
@login_required(roles=["social", "head_social", "admin"])
def ticket_print_sheet_document(current_user):
    sync_ticket_statuses()
    payload = request.get_json(silent=True) or {}
    period, error_response, status_code = resolve_ticket_period(payload.get("month"), payload.get("year"))
    if error_response:
        return error_response, status_code
    start_date, _end_date = period

    building_id, category_id, access_error = resolve_document_filters(current_user, payload)
    if access_error:
        return access_error

    tickets = query_month_tickets(
        start_date.month,
        start_date.year,
        building_id=building_id,
        category_id=category_id,
        statuses=["active"],
    )
    print_size = resolve_ticket_print_size(payload.get("print_size"))
    document = build_ticket_sheet_document(
        month=start_date.month,
        year=start_date.year,
        tickets=tickets,
        print_size=print_size,
    )
    db.session.commit()
    log_action(
        current_user,
        "print_ticket_sheet",
        "ticket_batch",
        None,
        {
            "month": start_date.month,
            "year": start_date.year,
            "building_id": building_id,
            "category_id": category_id,
            "print_size": print_size,
        },
    )
    return jsonify({"data": document})


@tickets_bp.post("/<ticket_id>/document")
@login_required(roles=["social", "head_social", "admin"])
def ticket_document(current_user, ticket_id):
    sync_ticket_statuses()
    payload = request.get_json(silent=True) or {}
    ticket = Ticket.query.filter_by(id=ticket_id).first_or_404()
    access_error = ensure_ticket_access(current_user, ticket)
    if access_error:
        return access_error
    if ticket.status == "cancelled":
        return jsonify({"error": "Отмененный талон нельзя печатать"}), 409

    print_size = resolve_ticket_print_size(payload.get("print_size"))
    document = build_ticket_sheet_document(
        month=ticket.month,
        year=ticket.year,
        tickets=[ticket],
        print_size=print_size,
    )
    db.session.commit()
    log_action(
        current_user,
        "print_ticket",
        "ticket",
        ticket.id,
        {
            "month": ticket.month,
            "year": ticket.year,
            "building_id": ticket.student.effective_meal_building_id,
            "print_size": print_size,
        },
    )
    return jsonify({"data": document})
