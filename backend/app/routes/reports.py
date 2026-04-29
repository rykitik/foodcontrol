from __future__ import annotations

from datetime import date
from io import BytesIO

from flask import Blueprint, jsonify, request, send_file

from app.auth import ensure_building_access, login_required
from app.services.accounting_documents import (
    build_cost_calculation_document,
    build_cost_calculation_workbook_bytes,
    build_cost_statement_document,
    build_cost_statement_workbook_bytes,
    build_meal_sheet_document,
    build_meal_sheet_workbook_bytes,
    reset_accounting_document_metadata,
    save_accounting_document_metadata,
)
from app.services.accounting_documents.context import build_accounting_document_context
from app.services.accounting_documents.global_metadata import (
    load_accounting_document_global_metadata_values,
    reset_accounting_document_global_metadata_values,
    save_accounting_document_global_metadata_values,
)
from app.services.meal_sheet_documents import build_meal_sheet_document_payload

reports_bp = Blueprint("reports", __name__)


def parse_period(payload):
    start_value = payload.get("period_start") or payload.get("start_date")
    end_value = payload.get("period_end") or payload.get("end_date")
    if not start_value or not end_value:
        return None, None
    try:
        return date.fromisoformat(start_value), date.fromisoformat(end_value)
    except ValueError:
        return "invalid", "invalid"


def resolve_meal_sheet_building_scope(current_user, payload: dict):
    if current_user.role == "social":
        return current_user.building_id, None

    building_id = payload.get("building_id")
    if building_id is None:
        return None, None

    try:
        scoped_building_id = int(building_id)
    except (TypeError, ValueError):
        return None, (jsonify({"error": "Некорректный building_id"}), 400)

    access_error = ensure_building_access(current_user, scoped_building_id)
    if access_error:
        return None, access_error

    return scoped_building_id, None


def parse_accounting_document_request(payload: dict, *, require_meal_type: bool = False):
    month = payload.get("month")
    year = payload.get("year")
    category_id = payload.get("category_id")

    if month is None or year is None:
        return None, (jsonify({"error": "Нужны month и year"}), 400)
    if category_id is None:
        return None, (jsonify({"error": "Нужен category_id"}), 400)

    try:
        parsed_month = int(month)
        parsed_year = int(year)
        parsed_category_id = int(category_id)
    except (TypeError, ValueError):
        return None, (jsonify({"error": "month, year и category_id должны быть числами"}), 400)

    if parsed_month < 1 or parsed_month > 12:
        return None, (jsonify({"error": "Месяц должен быть в диапазоне 1-12"}), 400)

    parsed = {
        "month": parsed_month,
        "year": parsed_year,
        "category_id": parsed_category_id,
    }

    if require_meal_type:
        meal_type = payload.get("meal_type")
        if meal_type not in {"breakfast", "lunch"}:
            return None, (jsonify({"error": "meal_type должен быть breakfast или lunch"}), 400)
        parsed["meal_type"] = meal_type

    return parsed, None


def resolve_accounting_document_context(current_user):
    try:
        context = build_accounting_document_context(
            full_name=current_user.full_name,
            generated_at=date.today(),
        )
    except ValueError as exc:
        return None, (jsonify({"error": str(exc)}), 400)

    return context, None


def parse_accounting_document_runtime(payload: dict, current_user, *, require_meal_type: bool = False):
    parsed, error = parse_accounting_document_request(payload, require_meal_type=require_meal_type)
    if error:
        return None, error

    context, context_error = resolve_accounting_document_context(current_user)
    if context_error:
        return None, context_error

    parsed["context"] = context
    return parsed, None


def parse_accounting_document_metadata_runtime(payload: dict, current_user):
    document_kind = payload.get("document_kind")
    if document_kind not in {"meal_sheet", "cost_statement", "cost_calculation"}:
        return None, (jsonify({"error": "document_kind должен быть meal_sheet, cost_statement или cost_calculation"}), 400)

    parsed, error = parse_accounting_document_runtime(payload, current_user, require_meal_type=document_kind == "meal_sheet")
    if error:
        return None, error

    parsed["document_kind"] = document_kind
    return parsed, None


@reports_bp.post("/meal-sheet/document")
@login_required(roles=["social", "head_social", "accountant", "admin"])
def meal_sheet_document(current_user):
    payload = request.get_json(silent=True) or {}
    period_start, period_end = parse_period(payload)
    if not period_start or not period_end:
        return jsonify({"error": "Нужны даты периода"}), 400
    if period_start == "invalid":
        return jsonify({"error": "Некорректный формат даты, нужен YYYY-MM-DD"}), 400

    building_id, access_error = resolve_meal_sheet_building_scope(current_user, payload)
    if access_error:
        return access_error
    category_id = payload.get("category_id")
    ticket_status = payload.get("status")
    document = build_meal_sheet_document_payload(
        period_start,
        period_end,
        category_id=category_id,
        building_id=building_id,
        ticket_status=ticket_status,
        author_name=current_user.full_name,
        include_reviewer=current_user.role != "social",
    )
    return jsonify({"data": document})


@reports_bp.post("/accounting-documents/meal-sheet/document")
@login_required(roles=["accountant", "head_social", "admin"])
def accountant_meal_sheet_document(current_user):
    payload = request.get_json(silent=True) or {}
    parsed, error = parse_accounting_document_runtime(payload, current_user, require_meal_type=True)
    if error:
        return error

    try:
        document = build_meal_sheet_document(**parsed)
    except LookupError as exc:
        return jsonify({"error": str(exc)}), 404
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"data": document})


@reports_bp.post("/accounting-documents/meal-sheet/xlsx")
@login_required(roles=["accountant", "head_social", "admin"])
def accountant_meal_sheet_xlsx(current_user):
    payload = request.get_json(silent=True) or {}
    parsed, error = parse_accounting_document_runtime(payload, current_user, require_meal_type=True)
    if error:
        return error

    try:
        workbook_bytes, filename = build_meal_sheet_workbook_bytes(**parsed)
    except LookupError as exc:
        return jsonify({"error": str(exc)}), 404
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return send_file(
        BytesIO(workbook_bytes),
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@reports_bp.post("/accounting-documents/cost-statement/document")
@login_required(roles=["accountant", "head_social", "admin"])
def accountant_cost_statement_document(current_user):
    payload = request.get_json(silent=True) or {}
    parsed, error = parse_accounting_document_runtime(payload, current_user)
    if error:
        return error

    try:
        document = build_cost_statement_document(**parsed)
    except LookupError as exc:
        return jsonify({"error": str(exc)}), 404
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"data": document})


@reports_bp.post("/accounting-documents/cost-statement/xlsx")
@login_required(roles=["accountant", "head_social", "admin"])
def accountant_cost_statement_xlsx(current_user):
    payload = request.get_json(silent=True) or {}
    parsed, error = parse_accounting_document_runtime(payload, current_user)
    if error:
        return error

    try:
        workbook_bytes, filename = build_cost_statement_workbook_bytes(**parsed)
    except LookupError as exc:
        return jsonify({"error": str(exc)}), 404
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return send_file(
        BytesIO(workbook_bytes),
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@reports_bp.post("/accounting-documents/cost-calculation/document")
@login_required(roles=["accountant", "head_social", "admin"])
def accountant_cost_calculation_document(current_user):
    payload = request.get_json(silent=True) or {}
    parsed, error = parse_accounting_document_runtime(payload, current_user)
    if error:
        return error

    try:
        document = build_cost_calculation_document(**parsed)
    except LookupError as exc:
        return jsonify({"error": str(exc)}), 404
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"data": document})


@reports_bp.post("/accounting-documents/cost-calculation/xlsx")
@login_required(roles=["accountant", "head_social", "admin"])
def accountant_cost_calculation_xlsx(current_user):
    payload = request.get_json(silent=True) or {}
    parsed, error = parse_accounting_document_runtime(payload, current_user)
    if error:
        return error

    try:
        workbook_bytes, filename = build_cost_calculation_workbook_bytes(**parsed)
    except LookupError as exc:
        return jsonify({"error": str(exc)}), 404
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return send_file(
        BytesIO(workbook_bytes),
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@reports_bp.post("/accounting-documents/metadata/save")
@login_required(roles=["accountant", "head_social", "admin"])
def accountant_document_metadata_save(current_user):
    payload = request.get_json(silent=True) or {}
    values = payload.get("values")
    if not isinstance(values, dict):
        return jsonify({"error": "Нужен объект values с реквизитами документа"}), 400

    parsed, error = parse_accounting_document_metadata_runtime(payload, current_user)
    if error:
        return error

    try:
        document = save_accounting_document_metadata(
            **parsed,
            updated_by_user_id=current_user.id,
            values=values,
        )
    except LookupError as exc:
        return jsonify({"error": str(exc)}), 404
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"data": document})


@reports_bp.post("/accounting-documents/metadata/reset")
@login_required(roles=["accountant", "head_social", "admin"])
def accountant_document_metadata_reset(current_user):
    payload = request.get_json(silent=True) or {}
    parsed, error = parse_accounting_document_metadata_runtime(payload, current_user)
    if error:
        return error

    try:
        document = reset_accounting_document_metadata(**parsed)
    except LookupError as exc:
        return jsonify({"error": str(exc)}), 404
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"data": document})


@reports_bp.get("/accounting-documents/global-metadata")
@login_required(roles=["accountant", "head_social", "admin"])
def accountant_document_global_metadata_get(current_user):
    return jsonify({"data": {"values": load_accounting_document_global_metadata_values()}})


@reports_bp.post("/accounting-documents/global-metadata/save")
@login_required(roles=["accountant", "head_social", "admin"])
def accountant_document_global_metadata_save(current_user):
    payload = request.get_json(silent=True) or {}
    values = payload.get("values")
    if not isinstance(values, dict):
        return jsonify({"error": "values object is required"}), 400

    saved_values = save_accounting_document_global_metadata_values(
        values,
        updated_by_user_id=current_user.id,
    )
    return jsonify({"data": {"values": saved_values}})


@reports_bp.post("/accounting-documents/global-metadata/reset")
@login_required(roles=["accountant", "head_social", "admin"])
def accountant_document_global_metadata_reset(current_user):
    payload = request.get_json(silent=True) or {}
    keys = payload.get("keys")
    if keys is not None and not isinstance(keys, list):
        return jsonify({"error": "keys must be a list"}), 400

    reset_values = reset_accounting_document_global_metadata_values(
        [str(key) for key in keys] if keys else None,
    )
    return jsonify({"data": {"values": reset_values}})
