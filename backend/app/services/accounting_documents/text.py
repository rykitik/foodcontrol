from __future__ import annotations

from dataclasses import replace
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .template_config import (
        CostCalculationTemplateConfig,
        CostStatementTemplateConfig,
        MealSheetTemplateConfig,
        PreparedByBinding,
    )


def repair_text(value: str) -> str:
    if not isinstance(value, str):
        return value
    if not _looks_like_mojibake(value):
        return value

    try:
        repaired = value.encode("cp1251").decode("utf-8")
    except UnicodeError:
        return value

    return repaired


def repair_prepared_by_binding(binding: "PreparedByBinding | None") -> "PreparedByBinding | None":
    if binding is None:
        return None
    return replace(binding, prefix=repair_text(binding.prefix))


def repair_cost_statement_config(config: "CostStatementTemplateConfig") -> "CostStatementTemplateConfig":
    return replace(
        config,
        category_code=repair_text(config.category_code),
        sheet_name=repair_text(config.sheet_name),
        visible_range=repair_text(config.visible_range),
        prepared_by_binding=repair_prepared_by_binding(config.prepared_by_binding),
    )


def repair_cost_calculation_config(config: "CostCalculationTemplateConfig") -> "CostCalculationTemplateConfig":
    return replace(
        config,
        category_code=repair_text(config.category_code),
        sheet_name=repair_text(config.sheet_name),
        visible_range=repair_text(config.visible_range),
        prepared_by_binding=repair_prepared_by_binding(config.prepared_by_binding),
    )


def repair_meal_sheet_config(config: "MealSheetTemplateConfig") -> "MealSheetTemplateConfig":
    return replace(
        config,
        category_code=repair_text(config.category_code),
        meal_type=repair_text(config.meal_type),
        sheet_name=repair_text(config.sheet_name),
        visible_range=repair_text(config.visible_range),
        prepared_by_binding=repair_prepared_by_binding(config.prepared_by_binding),
    )


def _looks_like_mojibake(value: str) -> bool:
    return any(token in value for token in ("Р", "С", "Ѓ", "љ", "™", "Ђ", "Ћ"))
