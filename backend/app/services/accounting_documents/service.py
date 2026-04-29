from __future__ import annotations

from .context import AccountingDocumentContext
from .editable_metadata import (
    apply_document_editable_metadata_overrides,
    normalize_supported_document_metadata_values,
)
from .html import render_accounting_document
from .global_metadata import (
    filter_accounting_document_global_metadata_values,
    filter_accounting_document_scoped_metadata_values,
    load_accounting_document_global_metadata_values,
    save_accounting_document_global_metadata_values,
)
from .metadata import cost_calculation_filename_by_code, cost_statement_filename_by_code, meal_sheet_filename_by_code
from .metadata_overrides import (
    load_accounting_document_metadata_override_values,
    reset_accounting_document_metadata_override_values,
    save_accounting_document_metadata_override_values,
)
from .payloads import build_cost_calculation_payload, build_cost_statement_payload, build_meal_sheet_payload
from .template_workbook import (
    build_cost_calculation_template_workbook,
    build_cost_statement_template_workbook,
    build_meal_sheet_template_workbook,
    save_workbook_bytes,
)


def build_meal_sheet_document(
    *,
    month: int,
    year: int,
    category_id: int,
    meal_type: str,
    context: AccountingDocumentContext,
) -> dict:
    payload = build_meal_sheet_payload(month=month, year=year, category_id=category_id, meal_type=meal_type, context=context)
    return _build_document_response(payload)


def build_meal_sheet_workbook_bytes(
    *,
    month: int,
    year: int,
    category_id: int,
    meal_type: str,
    context: AccountingDocumentContext,
) -> tuple[bytes, str]:
    payload = build_meal_sheet_payload(month=month, year=year, category_id=category_id, meal_type=meal_type, context=context)
    filename = meal_sheet_filename_by_code(payload["category_code"], meal_type, month, year)
    return _build_workbook_bytes(payload), filename


def build_cost_statement_document(
    *,
    month: int,
    year: int,
    category_id: int,
    context: AccountingDocumentContext,
) -> dict:
    payload = build_cost_statement_payload(month=month, year=year, category_id=category_id, context=context)
    return _build_document_response(payload)


def build_cost_statement_workbook_bytes(
    *,
    month: int,
    year: int,
    category_id: int,
    context: AccountingDocumentContext,
) -> tuple[bytes, str]:
    payload = build_cost_statement_payload(month=month, year=year, category_id=category_id, context=context)
    filename = cost_statement_filename_by_code(payload["category_code"], month, year)
    return _build_workbook_bytes(payload), filename


def build_cost_calculation_document(
    *,
    month: int,
    year: int,
    category_id: int,
    context: AccountingDocumentContext,
) -> dict:
    payload = build_cost_calculation_payload(month=month, year=year, category_id=category_id, context=context)
    return _build_document_response(payload)


def build_cost_calculation_workbook_bytes(
    *,
    month: int,
    year: int,
    category_id: int,
    context: AccountingDocumentContext,
) -> tuple[bytes, str]:
    payload = build_cost_calculation_payload(month=month, year=year, category_id=category_id, context=context)
    filename = cost_calculation_filename_by_code(payload["category_code"], month, year)
    return _build_workbook_bytes(payload), filename


def save_accounting_document_metadata(
    *,
    document_kind: str,
    month: int,
    year: int,
    category_id: int,
    context: AccountingDocumentContext,
    updated_by_user_id: str,
    values: dict[str, str],
    meal_type: str | None = None,
) -> dict:
    payload = _build_document_payload(
        document_kind=document_kind,
        month=month,
        year=year,
        category_id=category_id,
        meal_type=meal_type,
        context=context,
    )
    workbook, config = _build_template_workbook(payload)
    normalized_values = normalize_supported_document_metadata_values(workbook.active, payload, config, values)
    global_values = save_accounting_document_global_metadata_values(
        filter_accounting_document_global_metadata_values(normalized_values),
        updated_by_user_id=updated_by_user_id,
    )
    custom_values = save_accounting_document_metadata_override_values(
        payload,
        filter_accounting_document_scoped_metadata_values(normalized_values),
        updated_by_user_id=updated_by_user_id,
    )
    merged_values = _merge_metadata_values(global_values, custom_values)
    workbook, config = _build_template_workbook(payload, custom_values=merged_values)
    apply_document_editable_metadata_overrides(workbook.active, payload, config, merged_values)
    return render_accounting_document(payload, workbook, config, custom_values=merged_values)


def reset_accounting_document_metadata(
    *,
    document_kind: str,
    month: int,
    year: int,
    category_id: int,
    context: AccountingDocumentContext,
    meal_type: str | None = None,
) -> dict:
    payload = _build_document_payload(
        document_kind=document_kind,
        month=month,
        year=year,
        category_id=category_id,
        meal_type=meal_type,
        context=context,
    )
    reset_accounting_document_metadata_override_values(payload)
    workbook, config = _build_template_workbook(payload)
    return render_accounting_document(payload, workbook, config, custom_values={})


def _build_document_response(payload: dict) -> dict:
    custom_values = _load_document_metadata_values(payload)
    workbook, config = _build_template_workbook(payload, custom_values=custom_values)
    apply_document_editable_metadata_overrides(workbook.active, payload, config, custom_values)
    return render_accounting_document(payload, workbook, config, custom_values=custom_values)


def _build_workbook_bytes(payload: dict) -> bytes:
    custom_values = _load_document_metadata_values(payload)
    workbook, config = _build_template_workbook(payload, custom_values=custom_values)
    apply_document_editable_metadata_overrides(workbook.active, payload, config, custom_values)
    return save_workbook_bytes(workbook)


def _load_document_metadata_values(payload: dict) -> dict[str, str]:
    return _merge_metadata_values(
        load_accounting_document_global_metadata_values(),
        filter_accounting_document_scoped_metadata_values(
            load_accounting_document_metadata_override_values(payload),
        ),
    )


def _merge_metadata_values(global_values: dict[str, str], scoped_values: dict[str, str]) -> dict[str, str]:
    return {
        **filter_accounting_document_global_metadata_values(global_values),
        **filter_accounting_document_scoped_metadata_values(scoped_values),
    }


def _build_template_workbook(payload: dict, custom_values: dict[str, str] | None = None):
    document_type = payload["document_type"]
    if document_type == "meal_sheet":
        return build_meal_sheet_template_workbook(payload)
    if document_type == "cost_statement":
        return build_cost_statement_template_workbook(payload)
    if document_type == "cost_calculation":
        return build_cost_calculation_template_workbook(payload, custom_values=custom_values)
    raise ValueError(f"Unsupported accounting document type: {document_type}")


def _build_document_payload(
    *,
    document_kind: str,
    month: int,
    year: int,
    category_id: int,
    context: AccountingDocumentContext,
    meal_type: str | None = None,
) -> dict:
    if document_kind == "meal_sheet":
        if meal_type is None:
            raise ValueError("meal_type is required for meal_sheet metadata")
        return build_meal_sheet_payload(
            month=month,
            year=year,
            category_id=category_id,
            meal_type=meal_type,
            context=context,
        )

    if document_kind == "cost_statement":
        return build_cost_statement_payload(
            month=month,
            year=year,
            category_id=category_id,
            context=context,
        )

    if document_kind == "cost_calculation":
        return build_cost_calculation_payload(
            month=month,
            year=year,
            category_id=category_id,
            context=context,
        )

    raise ValueError(f"Unsupported accounting document kind: {document_kind}")
