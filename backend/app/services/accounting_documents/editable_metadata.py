from __future__ import annotations

from .cell_values import format_cell_display_value
from .meal_sheet_header import write_meal_sheet_institution
from .metadata_bindings import EditableMetadataBinding, resolve_document_editable_metadata_bindings
from .metadata_values import (
    normalize_decimal_metadata_value,
    normalize_metadata_text_value,
    parse_decimal_metadata_value,
)


def build_document_editable_metadata(
    worksheet,
    payload: dict,
    config,
    custom_values: dict[str, str] | None = None,
) -> list[dict[str, str | bool]]:
    bindings = resolve_document_editable_metadata_bindings(worksheet, payload, config)
    custom_value_keys = set((custom_values or {}).keys())
    return [
        _serialize_binding(worksheet, binding, is_custom=binding.key in custom_value_keys)
        for binding in bindings
    ]


def apply_document_editable_metadata_overrides(
    worksheet,
    payload: dict,
    config,
    custom_values: dict[str, str] | None,
) -> None:
    if not custom_values:
        return

    bindings_by_key = {
        binding.key: binding
        for binding in resolve_document_editable_metadata_bindings(worksheet, payload, config)
    }

    for key, raw_value in custom_values.items():
        binding = bindings_by_key.get(key)
        if binding is None:
            continue

        value = normalize_metadata_text_value(raw_value)
        if payload.get("document_type") == "meal_sheet" and key == "institution":
            write_meal_sheet_institution(worksheet, config, value)
            continue

        worksheet[binding.cell] = _compose_binding_value(binding, value)


def normalize_supported_document_metadata_values(
    worksheet,
    payload: dict,
    config,
    values: dict[str, str] | None,
) -> dict[str, str]:
    if not isinstance(values, dict):
        return {}

    bindings_by_key = {
        binding.key: binding
        for binding in resolve_document_editable_metadata_bindings(worksheet, payload, config)
    }
    normalized: dict[str, str] = {}

    for key, value in values.items():
        if not isinstance(key, str):
            continue
        binding = bindings_by_key.get(key)
        if binding is None:
            continue
        normalized[key] = _normalize_binding_value(binding, value)

    return normalized


def _serialize_binding(
    worksheet,
    binding: EditableMetadataBinding,
    *,
    is_custom: bool,
) -> dict[str, str | bool]:
    cell = worksheet[binding.cell]
    raw_value = format_cell_display_value(cell.value, cell.number_format)
    value = _extract_binding_value(raw_value, binding)

    payload: dict[str, str | bool] = {
        "key": binding.key,
        "label": binding.label,
        "section": binding.section,
        "cell": binding.cell,
        "mode": binding.mode,
        "value": value,
        "isCustom": is_custom,
    }
    if binding.placeholder:
        payload["placeholder"] = binding.placeholder
    if binding.prefix:
        payload["prefix"] = binding.prefix
    if binding.suffix:
        payload["suffix"] = binding.suffix
    return payload


def _extract_binding_value(value: str, binding: EditableMetadataBinding) -> str:
    if binding.mode != "prefixed_text_cell":
        return value

    next_value = value
    if binding.prefix and next_value.startswith(binding.prefix):
        next_value = next_value[len(binding.prefix) :]
    if binding.suffix and next_value.endswith(binding.suffix):
        next_value = next_value[: -len(binding.suffix)]
    return next_value.strip()


def _normalize_binding_value(binding: EditableMetadataBinding, value) -> str:
    if binding.value_kind == "decimal":
        return normalize_decimal_metadata_value(value, field_label=binding.label)
    return normalize_metadata_text_value(value)


def _compose_binding_value(binding: EditableMetadataBinding, value: str):
    if binding.value_kind == "decimal":
        return parse_decimal_metadata_value(value, field_label=binding.label)
    if binding.mode == "prefixed_text_cell":
        return f"{binding.prefix}{value}{binding.suffix}"

    return value if value else None
