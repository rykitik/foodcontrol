from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from openpyxl.worksheet.worksheet import Worksheet

from .meal_sheet_header import resolve_meal_sheet_institution_cell
from .template_config import (
    CostCalculationTemplateConfig,
    CostStatementTemplateConfig,
    MealSheetTemplateConfig,
    PreparedByBinding,
)

EditableMetadataMode = Literal["value_cell", "prefixed_text_cell"]
EditableMetadataValueKind = Literal["text", "decimal"]


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
    value_kind: EditableMetadataValueKind = "text"


def resolve_document_editable_metadata_bindings(
    worksheet: Worksheet,
    payload: dict,
    config,
) -> list[EditableMetadataBinding]:
    document_type = payload.get("document_type")
    if document_type == "meal_sheet":
        return _meal_sheet_bindings(worksheet, config)
    if document_type == "combined_meal_sheet":
        return _combined_meal_sheet_bindings(config)
    if document_type == "cost_statement":
        return _cost_statement_bindings(config)
    if document_type == "cost_calculation":
        return _cost_calculation_bindings(config)
    return []


def _cost_statement_bindings(config: CostStatementTemplateConfig) -> list[EditableMetadataBinding]:
    bindings = [
        EditableMetadataBinding("reportDate", "Дата составления", "Коды и даты", config.report_date_cell),
        EditableMetadataBinding("institution", "Учреждение", "Организация", config.institution_cell),
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
        _prepared_by_binding_to_metadata(
            key="preparedByName",
            label="ФИО составившего",
            section="Подписи",
            binding=config.prepared_by_binding,
        ),
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
        EditableMetadataBinding("institution", "Учреждение", "Организация", institution_cell),
    ]

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


def _combined_meal_sheet_bindings(config) -> list[EditableMetadataBinding]:
    bindings = [
        EditableMetadataBinding("institution", "Учреждение", "Организация", config.institution_cell),
    ]

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
        EditableMetadataBinding(
            "dailyCompensationRate",
            "Дневной норматив компенсации",
            "Параметры расчета",
            config.daily_compensation_rate_cell,
            value_kind="decimal",
        ),
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


def _row_from_cell(cell_ref: str) -> int:
    return int("".join(char for char in cell_ref if char.isdigit()))


def _column_from_cell(cell_ref: str) -> str:
    return "".join(char for char in cell_ref if char.isalpha())
