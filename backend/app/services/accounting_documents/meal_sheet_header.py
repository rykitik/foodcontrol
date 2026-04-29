from __future__ import annotations

from openpyxl.worksheet.worksheet import Worksheet

from .template_config import MealSheetTemplateConfig


def resolve_meal_sheet_institution_cell(
    worksheet: Worksheet,
    config: MealSheetTemplateConfig,
) -> str:
    return config.institution_cell


def write_meal_sheet_institution(
    worksheet: Worksheet,
    config: MealSheetTemplateConfig,
    institution: str,
) -> str:
    worksheet[config.institution_cell] = institution
    return config.institution_cell
