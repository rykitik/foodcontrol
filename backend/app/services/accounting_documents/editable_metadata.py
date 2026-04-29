from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from openpyxl.worksheet.worksheet import Worksheet

from .cell_values import format_cell_display_value
from .meal_sheet_header import resolve_meal_sheet_institution_cell, write_meal_sheet_institution
from .template_config import (
    CostCalculationTemplateConfig,
    CostStatementTemplateConfig,
    MealSheetTemplateConfig,
    PreparedByBinding,
)

EditableMetadataMode = Literal["value_cell", "prefixed_text_cell"]


@dataclass(frozen=True, slots=True)
class EditableMetadataBinding:
    key: str
    label: str
    section: str
    cell: str
    mode: EditableMetadataMode = "value_cell"
    placeholder: str | None = None
    prefix: str = ""
    suffix: str = ""


def resolve_document_editable_metadata_bindings(
    worksheet: Worksheet,
    payload: dict,
    config,
) -> list[EditableMetadataBinding]:
    document_type = payload.get("document_type")
    if document_type == "meal_sheet":
        return _meal_sheet_bindings(worksheet, config)
    if document_type == "cost_statement":
        return _cost_statement_bindings(config)
    if document_type == "cost_calculation":
        return _cost_calculation_bindings(config)
    return []


def build_document_editable_metadata(
    worksheet: Worksheet,
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
    worksheet: Worksheet,
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

        value = raw_value.strip()
        if payload.get("document_type") == "meal_sheet" and key == "institution":
            write_meal_sheet_institution(worksheet, config, value)
            continue

        worksheet[binding.cell] = _compose_binding_value(binding, value)


def normalize_supported_document_metadata_values(
    worksheet: Worksheet,
    payload: dict,
    config,
    values: dict[str, str] | None,
) -> dict[str, str]:
    if not isinstance(values, dict):
        return {}

    supported_keys = {
        binding.key
        for binding in resolve_document_editable_metadata_bindings(worksheet, payload, config)
    }
    normalized: dict[str, str] = {}

    for key, value in values.items():
        if not isinstance(key, str) or key not in supported_keys:
            continue
        if value is None:
            normalized[key] = ""
            continue
        if isinstance(value, str):
            normalized[key] = value.strip()
            continue
        normalized[key] = str(value).strip()

    return normalized


def _cost_statement_bindings(config: CostStatementTemplateConfig) -> list[EditableMetadataBinding]:
    bindings = [
        EditableMetadataBinding("title", "Заголовок", "Заголовок", "E6"),
        EditableMetadataBinding("subtitle", "Подзаголовок", "Заголовок", "B7"),
        EditableMetadataBinding(
            "okudForm",
            "Форма по ОКУД",
            "Коды и даты",
            "H7",
            mode="prefixed_text_cell",
            prefix="Форма ",
            suffix=" по ОКУД",
        ),
        EditableMetadataBinding("okudCode", "Код ОКУД", "Коды и даты", "I7"),
        EditableMetadataBinding("monthLabel", "Месяц", "Коды и даты", config.month_cell),
        EditableMetadataBinding("yearLabel", "Год", "Коды и даты", config.year_cell),
        EditableMetadataBinding("reportDate", "Дата составления", "Коды и даты", config.report_date_cell),
        EditableMetadataBinding("institution", "Учреждение", "Организация", config.institution_cell),
    ]

    if config.category_cell is not None:
        bindings.append(
            EditableMetadataBinding(
                "structuralUnit",
                "Структурное подразделение",
                "Организация",
                config.category_cell,
            )
        )

    bindings.extend(
        [
            EditableMetadataBinding("division", "Раздел (подраздел)", "Организация", "C11"),
            EditableMetadataBinding("targetArticle", "Целевая статья", "Организация", "C12"),
            EditableMetadataBinding("expenseType", "Вид расхода", "Организация", "C13"),
            EditableMetadataBinding(
                "measurementUnit",
                "Единица измерения",
                "Организация",
                "A14",
                mode="prefixed_text_cell",
                prefix="Единица измерения: ",
            ),
            EditableMetadataBinding("fundingSource", "Источник финансирования", "Организация", "C15"),
            EditableMetadataBinding("okpoCode", "ОКПО", "Коды", "I9"),
            EditableMetadataBinding("kspCode", "КСП", "Коды", "I10"),
            EditableMetadataBinding("fkrCode", "ФКР", "Коды", "I11"),
            EditableMetadataBinding("kcsrCode", "КЦСР", "Коды", "I12"),
            EditableMetadataBinding("kvrCode", "КВР", "Коды", "I13"),
            EditableMetadataBinding("okeiCode", "ОКЕИ", "Коды", "I14"),
        ]
    )

    bindings.extend(_cost_statement_signature_bindings(config))
    return bindings


def _cost_statement_signature_bindings(
    config: CostStatementTemplateConfig,
) -> list[EditableMetadataBinding]:
    if config.prepared_by_binding is None:
        return []

    prepared_name_cell = config.prepared_by_binding.cell
    prepared_row = _row_from_cell(prepared_name_cell)
    prepared_column = _column_from_cell(prepared_name_cell)
    checked_row = prepared_row + 2

    return [
        EditableMetadataBinding("preparedByLabel", "Подпись: составил", "Подписи", f"A{prepared_row}"),
        _prepared_by_binding_to_metadata(
            key="preparedByName",
            label="ФИО составившего",
            section="Подписи",
            binding=config.prepared_by_binding,
        ),
        EditableMetadataBinding("checkedByLabel", "Подпись: проверил", "Подписи", f"A{checked_row}"),
        EditableMetadataBinding(
            "checkedByName",
            "ФИО проверившего",
            "Подписи",
            f"{prepared_column}{checked_row}",
        ),
    ]


def _meal_sheet_bindings(
    worksheet: Worksheet,
    config: MealSheetTemplateConfig,
) -> list[EditableMetadataBinding]:
    institution_cell = resolve_meal_sheet_institution_cell(worksheet, config)
    bindings = [
        EditableMetadataBinding("title", "Заголовок", "Заголовок", config.title_cell),
        EditableMetadataBinding("monthLabel", "Месяц", "Период", config.month_cell),
        EditableMetadataBinding("yearLabel", "Год", "Период", config.year_cell),
        EditableMetadataBinding("institution", "Учреждение", "Организация", institution_cell),
    ]

    if config.student_header_cell is not None:
        bindings.append(
            EditableMetadataBinding(
                "studentHeader",
                "Заголовок колонки студентов",
                "Таблица",
                config.student_header_cell,
            )
        )

    if config.price_label_cell is not None:
        bindings.append(
            EditableMetadataBinding(
                "priceLabel",
                "Подпись стоимости питания",
                "Таблица",
                config.price_label_cell,
            )
        )

    if config.prepared_by_binding is not None:
        bindings.append(
            _prepared_by_binding_to_metadata(
                key="preparedByName",
                label="ФИО бухгалтера",
                section="Подписи",
                binding=config.prepared_by_binding,
            )
        )

    return bindings


def _cost_calculation_bindings(
    config: CostCalculationTemplateConfig,
) -> list[EditableMetadataBinding]:
    bindings = [
        EditableMetadataBinding("institution", "Учреждение", "Заголовок", "A1"),
        EditableMetadataBinding("title", "Заголовок", "Заголовок", "A2"),
        EditableMetadataBinding("subtitle", "Подзаголовок", "Заголовок", "A3"),
        EditableMetadataBinding("categoryLine", "Строка категории", "Период", config.category_line_cell),
        EditableMetadataBinding("monthLabel", "Месяц", "Период", config.month_cell),
        EditableMetadataBinding("yearLabel", "Год", "Период", config.year_cell),
    ]

    if config.prepared_by_binding is not None:
        bindings.append(
            _prepared_by_binding_to_metadata(
                key="preparedByName",
                label="ФИО ведущего бухгалтера",
                section="Подписи",
                binding=config.prepared_by_binding,
            )
        )

    return bindings


def _prepared_by_binding_to_metadata(
    *,
    key: str,
    label: str,
    section: str,
    binding: PreparedByBinding,
) -> EditableMetadataBinding:
    if binding.mode == "prefixed_text_cell":
        return EditableMetadataBinding(
            key=key,
            label=label,
            section=section,
            cell=binding.cell,
            mode="prefixed_text_cell",
            prefix=binding.prefix,
        )

    return EditableMetadataBinding(
        key=key,
        label=label,
        section=section,
        cell=binding.cell,
    )


def _serialize_binding(
    worksheet: Worksheet,
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


def _compose_binding_value(binding: EditableMetadataBinding, value: str):
    if binding.mode == "prefixed_text_cell":
        return f"{binding.prefix}{value}{binding.suffix}"

    return value if value else None


def _row_from_cell(cell_ref: str) -> int:
    return int("".join(char for char in cell_ref if char.isdigit()))


def _column_from_cell(cell_ref: str) -> str:
    return "".join(char for char in cell_ref if char.isalpha())
