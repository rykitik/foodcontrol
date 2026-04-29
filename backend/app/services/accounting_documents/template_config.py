from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .text import (
    repair_cost_calculation_config,
    repair_cost_statement_config,
    repair_meal_sheet_config,
)


PageOrientation = Literal["portrait", "landscape"]
ColumnWidthContract = tuple[tuple[str, float], ...]


@dataclass(frozen=True, slots=True)
class PreparedByBinding:
    cell: str
    mode: Literal["value_cell", "prefixed_text_cell"]
    prefix: str = ""


@dataclass(frozen=True, slots=True)
class CostStatementTemplateConfig:
    category_code: str
    sheet_name: str
    visible_range: str
    clear_ranges: tuple[str, ...]
    clear_cells: tuple[str, ...] = ()
    unhide_row_spans: tuple[tuple[int, int], ...] = ()
    hide_row_spans: tuple[tuple[int, int], ...] = ((1, 5),)
    category_cell: str | None = "C10"
    document_type: Literal["cost_statement"] = "cost_statement"
    page_orientation: Literal["portrait"] = "portrait"
    month_cell: str = "C8"
    year_cell: str = "G8"
    report_date_cell: str = "I8"
    institution_cell: str = "C9"
    index_column: str = "A"
    student_column: str = "B"
    group_column: str = "F"
    amount_column: str = "G"
    data_start_row: int = 18
    total_row: int = 84
    column_width_contract: ColumnWidthContract = ()
    prepared_by_binding: PreparedByBinding | None = None

    @property
    def capacity(self) -> int:
        return self.total_row - self.data_start_row


@dataclass(frozen=True, slots=True)
class CostCalculationTemplateConfig:
    category_code: str
    sheet_name: str
    visible_range: str
    clear_ranges: tuple[str, ...]
    clear_cells: tuple[str, ...] = ()
    unhide_row_spans: tuple[tuple[int, int], ...] = ()
    document_type: Literal["cost_calculation"] = "cost_calculation"
    page_orientation: Literal["portrait"] = "portrait"
    category_line_cell: str = "B4"
    month_cell: str = "C5"
    year_cell: str = "E5"
    study_days_cell: str = "C7"
    daily_compensation_rate_cell: str = "G7"
    index_column: str = "A"
    student_column: str = "B"
    study_days_column: str = "C"
    accrued_amount_column: str = "D"
    meal_amount_column: str = "E"
    payout_amount_column: str = "F"
    note_column: str = "G"
    data_start_row: int = 9
    total_row: int = 39
    signature_row: int = 41
    column_width_contract: ColumnWidthContract = ()
    prepared_by_binding: PreparedByBinding | None = None

    @property
    def capacity(self) -> int:
        return self.total_row - self.data_start_row


@dataclass(frozen=True, slots=True)
class MealSheetTemplateConfig:
    category_code: str
    meal_type: str
    sheet_name: str
    visible_range: str
    clear_ranges: tuple[str, ...]
    clear_cells: tuple[str, ...] = ()
    unhide_row_spans: tuple[tuple[int, int], ...] = ()
    student_header_cell: str | None = "B9"
    document_type: Literal["meal_sheet"] = "meal_sheet"
    page_orientation: Literal["landscape"] = "landscape"
    title_cell: str = "A7"
    month_cell: str = "S7"
    year_cell: str = "V7"
    institution_cell: str = "AP7"
    header_day_row: int = 9
    meal_label_row: int = 10
    price_row: int = 11
    price_label_cell: str | None = "D10"
    index_column: str = "A"
    student_column: str = "B"
    group_column: str = "C"
    date_column: str | None = "D"
    total_column: str = "AP"
    data_start_row: int = 12
    count_row: int = 44
    amount_row: int = 45
    signature_row: int = 47
    day_slot_width: float | None = None
    prepared_by_binding: PreparedByBinding | None = None

    @property
    def capacity(self) -> int:
        return self.count_row - self.data_start_row


_STANDARD_COST_STATEMENT_COLUMN_WIDTH_CONTRACT: ColumnWidthContract = (
    ("A", 7.140625),
    ("B", 16.140625),
    ("C", 15.285156),
    ("D", 3.285156),
    ("E", 13.710938),
    ("F", 10.710938),
    ("G", 6.285156),
    ("H", 17.855469),
    ("I", 11.140625),
)

_ORPHAN_COST_STATEMENT_COLUMN_WIDTH_CONTRACT: ColumnWidthContract = (
    ("A", 7.140625),
    ("B", 13.285156),
    ("C", 15.285156),
    ("D", 3.285156),
    ("E", 13.710938),
    ("F", 16.425781),
    ("G", 6.285156),
    ("H", 17.855469),
    ("I", 11.140625),
)

_COST_CALCULATION_COLUMN_WIDTH_CONTRACT: ColumnWidthContract = (
    ("A", 4.855469),
    ("B", 38.425781),
    ("C", 7.855469),
    ("D", 12.425781),
    ("E", 9.855469),
    ("F", 12.570312),
    ("G", 12.855469),
)


COST_STATEMENT_TEMPLATES: dict[str, CostStatementTemplateConfig] = {
    "low_income": CostStatementTemplateConfig(
        category_code="low_income",
        sheet_name="РІРµРґРѕРјРѕСЃС‚СЊ РјР°Р»РѕРёРјСѓС‰РёС…",
        visible_range="A1:I89",
        clear_ranges=("A18:G83",),
        unhide_row_spans=((2, 5), (86, 89)),
        total_row=84,
        column_width_contract=_STANDARD_COST_STATEMENT_COLUMN_WIDTH_CONTRACT,
        prepared_by_binding=PreparedByBinding(cell="E86", mode="value_cell"),
    ),
    "ovz": CostStatementTemplateConfig(
        category_code="ovz",
        sheet_name="РІРµРґРѕРјРѕСЃС‚СЊ РћР’Р—",
        visible_range="A1:I88",
        clear_ranges=("A18:G82",),
        total_row=83,
        column_width_contract=_STANDARD_COST_STATEMENT_COLUMN_WIDTH_CONTRACT,
        prepared_by_binding=PreparedByBinding(cell="E85", mode="value_cell"),
    ),
    "orphan": CostStatementTemplateConfig(
        category_code="orphan",
        sheet_name="РІРµРґРѕРјРѕСЃС‚СЊ СЃРёСЂРѕС‚",
        visible_range="A1:I53",
        clear_ranges=("A18:G47",),
        unhide_row_spans=((2, 5), (50, 53)),
        total_row=48,
        column_width_contract=_ORPHAN_COST_STATEMENT_COLUMN_WIDTH_CONTRACT,
        prepared_by_binding=PreparedByBinding(cell="E50", mode="value_cell"),
    ),
    "large_family": CostStatementTemplateConfig(
        category_code="large_family",
        sheet_name="РІРµРґРѕРјРѕСЃС‚СЊ РјРЅРѕРі",
        visible_range="A1:I90",
        clear_ranges=("A18:G84",),
        unhide_row_spans=((2, 5), (87, 90)),
        total_row=85,
        column_width_contract=_STANDARD_COST_STATEMENT_COLUMN_WIDTH_CONTRACT,
        prepared_by_binding=PreparedByBinding(cell="E87", mode="value_cell"),
    ),
}


COST_CALCULATION_TEMPLATES: dict[str, CostCalculationTemplateConfig] = {
    "orphan": CostCalculationTemplateConfig(
        category_code="orphan",
        sheet_name="СЂР°СЃС‡РµС‚ СЃРёСЂРѕС‚",
        visible_range="A1:G41",
        clear_ranges=("A9:G38",),
        clear_cells=("D39", "E39", "F39"),
        column_width_contract=_COST_CALCULATION_COLUMN_WIDTH_CONTRACT,
        prepared_by_binding=PreparedByBinding(
            cell="A41",
            mode="prefixed_text_cell",
            prefix="Р’РµРґСѓС‰РёР№ Р±СѓС…РіР°Р»С‚РµСЂ _______________",
        ),
    ),
}


MEAL_SHEET_TEMPLATES: dict[tuple[str, str], MealSheetTemplateConfig] = {
    ("low_income", "lunch"): MealSheetTemplateConfig(
        category_code="low_income",
        meal_type="lunch",
        sheet_name="С‚Р°Р±РµР»СЊ РјР°Р»РѕРёРјСѓС‰РёС…",
        visible_range="A7:AP47",
        clear_ranges=("A12:AP43",),
        unhide_row_spans=((46, 47),),
        institution_cell="AP7",
        total_column="AP",
        data_start_row=12,
        count_row=44,
        amount_row=45,
        signature_row=47,
        day_slot_width=9.731477,
        prepared_by_binding=PreparedByBinding(
            cell="L47",
            mode="prefixed_text_cell",
            prefix="Р‘СѓС…РіР°Р»С‚РµСЂ ___________________",
        ),
    ),
    ("ovz", "breakfast"): MealSheetTemplateConfig(
        category_code="ovz",
        meal_type="breakfast",
        sheet_name="С‚Р°Р±РµР»СЊ РћР’Р— Р·Р°РІС‚СЂР°Рє",
        visible_range="A7:AR47",
        clear_ranges=("A12:AR43",),
        unhide_row_spans=((46, 47),),
        institution_cell="AR7",
        total_column="AR",
        data_start_row=12,
        count_row=44,
        amount_row=45,
        signature_row=47,
        day_slot_width=9.860677,
        prepared_by_binding=PreparedByBinding(
            cell="L47",
            mode="prefixed_text_cell",
            prefix="Р‘СѓС…РіР°Р»С‚РµСЂ ___________________",
        ),
    ),
    ("ovz", "lunch"): MealSheetTemplateConfig(
        category_code="ovz",
        meal_type="lunch",
        sheet_name="С‚Р°Р±РµР»СЊ РћР’Р— РѕР±РµРґ",
        visible_range="A7:AO47",
        clear_ranges=("A12:AO43",),
        unhide_row_spans=((46, 47),),
        institution_cell="AO7",
        total_column="AO",
        data_start_row=12,
        count_row=44,
        amount_row=45,
        signature_row=47,
        day_slot_width=10.351432,
        prepared_by_binding=PreparedByBinding(
            cell="L47",
            mode="prefixed_text_cell",
            prefix="Р‘СѓС…РіР°Р»С‚РµСЂ ___________________",
        ),
    ),
    ("orphan", "lunch"): MealSheetTemplateConfig(
        category_code="orphan",
        meal_type="lunch",
        sheet_name="С‚Р°Р±РµР»СЊ СЃРёСЂРѕС‚",
        visible_range="A1:AQ40",
        clear_ranges=("A6:AQ36",),
        unhide_row_spans=((40, 40),),
        title_cell="A1",
        month_cell="S1",
        year_cell="V1",
        institution_cell="AQ1",
        header_day_row=3,
        meal_label_row=4,
        price_row=5,
        price_label_cell=None,
        group_column="C",
        date_column=None,
        total_column="AQ",
        data_start_row=6,
        count_row=37,
        amount_row=38,
        signature_row=40,
        day_slot_width=9.482485,
        prepared_by_binding=PreparedByBinding(
            cell="K40",
            mode="prefixed_text_cell",
            prefix="Р‘СѓС…РіР°Р»С‚РµСЂ ___________________",
        ),
    ),
    ("large_family", "breakfast"): MealSheetTemplateConfig(
        category_code="large_family",
        meal_type="breakfast",
        sheet_name="С‚Р°Р±РµР»СЊ РјРЅРѕРі Р·Р°РІС‚СЂР°Рє",
        visible_range="A7:AU51",
        clear_ranges=("A12:AU47",),
        unhide_row_spans=((50, 51),),
        institution_cell="AS7",
        total_column="AS",
        data_start_row=12,
        count_row=48,
        amount_row=49,
        signature_row=51,
        day_slot_width=9.726815,
        prepared_by_binding=PreparedByBinding(
            cell="L51",
            mode="prefixed_text_cell",
            prefix="Р‘СѓС…РіР°Р»С‚РµСЂ ___________________",
        ),
    ),
    ("large_family", "lunch"): MealSheetTemplateConfig(
        category_code="large_family",
        meal_type="lunch",
        sheet_name="С‚Р°Р±РµР»СЊ РјРЅРѕРі РѕР±РµРґ",
        visible_range="A7:AQ36",
        clear_ranges=("A12:AQ32",),
        unhide_row_spans=((35, 36),),
        institution_cell="AP7",
        total_column="AP",
        data_start_row=12,
        count_row=33,
        amount_row=34,
        signature_row=36,
        day_slot_width=10.201739,
        prepared_by_binding=PreparedByBinding(
            cell="L36",
            mode="prefixed_text_cell",
            prefix="Р‘СѓС…РіР°Р»С‚РµСЂ ___________________",
        ),
    ),
}

ALL_ACCOUNTING_CATEGORY_CODE = "all"
CANONICAL_COST_STATEMENT_TEMPLATE_CODE = "large_family"
CANONICAL_COST_CALCULATION_TEMPLATE_CODE = "orphan"
CANONICAL_MEAL_SHEET_TEMPLATE_CODES: dict[str, str] = {
    "breakfast": "large_family",
    "lunch": "low_income",
}


def resolve_cost_statement_template(_category_code: str) -> CostStatementTemplateConfig:
    template = COST_STATEMENT_TEMPLATES.get(
        _category_code,
        COST_STATEMENT_TEMPLATES[CANONICAL_COST_STATEMENT_TEMPLATE_CODE],
    )
    return repair_cost_statement_config(template)


def resolve_cost_calculation_template(_category_code: str) -> CostCalculationTemplateConfig:
    template = COST_CALCULATION_TEMPLATES.get(
        _category_code,
        COST_CALCULATION_TEMPLATES[CANONICAL_COST_CALCULATION_TEMPLATE_CODE],
    )
    return repair_cost_calculation_config(template)


def resolve_meal_sheet_template(_category_code: str, meal_type: str) -> MealSheetTemplateConfig:
    direct_match = MEAL_SHEET_TEMPLATES.get((_category_code, meal_type))
    if direct_match is not None:
        return repair_meal_sheet_config(direct_match)

    category_code = CANONICAL_MEAL_SHEET_TEMPLATE_CODES.get(meal_type)
    if not category_code:
        raise ValueError("Р”Р»СЏ РІС‹Р±СЂР°РЅРЅРѕР№ РєР°С‚РµРіРѕСЂРёРё РЅРµС‚ СЌС‚Р°Р»РѕРЅРЅРѕРіРѕ С€Р°Р±Р»РѕРЅР° С‚Р°Р±РµР»СЏ РїРѕ СЌС‚РѕРјСѓ РїСЂРёРµРјСѓ РїРёС‰Рё")

    return repair_meal_sheet_config(MEAL_SHEET_TEMPLATES[(category_code, meal_type)])



