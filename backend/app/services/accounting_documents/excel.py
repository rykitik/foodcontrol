from __future__ import annotations

from .template_workbook import (
    build_cost_calculation_template_workbook,
    build_cost_statement_template_workbook,
    build_meal_sheet_template_workbook,
    save_workbook_bytes,
)


def build_meal_sheet_workbook(payload: dict) -> bytes:
    workbook, _ = build_meal_sheet_template_workbook(payload)
    return save_workbook_bytes(workbook)


def build_cost_statement_workbook(payload: dict) -> bytes:
    workbook, _ = build_cost_statement_template_workbook(payload)
    return save_workbook_bytes(workbook)


def build_cost_calculation_workbook(payload: dict) -> bytes:
    workbook, _ = build_cost_calculation_template_workbook(payload)
    return save_workbook_bytes(workbook)
