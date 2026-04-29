from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from .template_config import PreparedByBinding

DAY_COLUMN_START = 5
MAX_DAY_COUNT = 31
BREAKFAST_TOTAL_COLUMN = "AJ"
LUNCH_TOTAL_COLUMN = "AK"
AMOUNT_TOTAL_COLUMN = "AL"
HEADER_ROW = 5
DAY_MARK_ROW = 6
DATA_START_ROW = 7


@dataclass(frozen=True, slots=True)
class CombinedMealSheetConfig:
    visible_range: str
    prepared_by_binding: PreparedByBinding
    institution_cell: str = "A1"
    document_type: Literal["combined_meal_sheet"] = "combined_meal_sheet"
    page_orientation: Literal["landscape"] = "landscape"


def build_combined_meal_sheet_workbook(payload: dict) -> tuple[Workbook, CombinedMealSheetConfig]:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = _safe_sheet_title(f"табель общий {payload['category_name']}")
    worksheet.sheet_view.showGridLines = False

    row_count = max(len(payload["rows"]), 1)
    summary_start_row = DATA_START_ROW + row_count
    signature_row = summary_start_row + 4
    config = CombinedMealSheetConfig(
        visible_range=f"A1:{AMOUNT_TOTAL_COLUMN}{signature_row}",
        prepared_by_binding=PreparedByBinding(
            cell=f"A{signature_row}",
            mode="prefixed_text_cell",
            prefix="Бухгалтер ___________________",
        ),
    )

    _setup_page(worksheet, config)
    _setup_columns(worksheet, payload)
    _write_header(worksheet, payload)
    _write_rows(worksheet, payload, row_count)
    _write_totals(worksheet, payload, summary_start_row)
    _write_signature(worksheet, payload, config)
    _style_document(worksheet, signature_row)
    return workbook, config


def _setup_page(worksheet, config: CombinedMealSheetConfig) -> None:
    worksheet.print_area = config.visible_range
    worksheet.page_setup.orientation = "landscape"
    worksheet.page_setup.paperSize = "9"
    worksheet.page_setup.fitToWidth = 1
    worksheet.page_setup.fitToHeight = 0
    worksheet.sheet_properties.pageSetUpPr.fitToPage = True
    worksheet.page_margins.left = 0.25
    worksheet.page_margins.right = 0.25
    worksheet.page_margins.top = 0.35
    worksheet.page_margins.bottom = 0.35
    worksheet.page_margins.header = 0.1
    worksheet.page_margins.footer = 0.1
    worksheet.print_title_rows = f"1:{DAY_MARK_ROW}"
    worksheet.freeze_panes = f"{get_column_letter(DAY_COLUMN_START)}{DATA_START_ROW}"


def _setup_columns(worksheet, payload: dict) -> None:
    widths = {
        "A": 4.0,
        "B": 23.0,
        "C": 8.5,
        "D": 12.0,
        BREAKFAST_TOTAL_COLUMN: 6.5,
        LUNCH_TOTAL_COLUMN: 6.5,
        AMOUNT_TOTAL_COLUMN: 9.0,
    }
    for column_letter, width in widths.items():
        worksheet.column_dimensions[column_letter].width = width

    active_day_count = len(payload["days"])
    for offset in range(MAX_DAY_COUNT):
        column_letter = get_column_letter(DAY_COLUMN_START + offset)
        worksheet.column_dimensions[column_letter].width = 2.2
        worksheet.column_dimensions[column_letter].hidden = offset >= active_day_count


def _write_header(worksheet, payload: dict) -> None:
    worksheet.merge_cells(f"A1:{AMOUNT_TOTAL_COLUMN}1")
    worksheet.merge_cells(f"A2:{AMOUNT_TOTAL_COLUMN}2")
    worksheet.merge_cells(f"A3:{AMOUNT_TOTAL_COLUMN}3")

    worksheet["A1"] = payload["form_metadata"]["institution"]
    worksheet["A2"] = payload["title"]
    worksheet["A3"] = payload["subtitle"]

    fixed_headers = {
        "A": "№",
        "B": "Фамилия, имя, отчество",
        "C": "Группа",
        "D": "Категория",
        BREAKFAST_TOTAL_COLUMN: "Завтрак",
        LUNCH_TOTAL_COLUMN: "Обед",
        AMOUNT_TOTAL_COLUMN: "Сумма",
    }
    for column_letter, value in fixed_headers.items():
        worksheet[f"{column_letter}{HEADER_ROW}"] = value
        worksheet[f"{column_letter}{DAY_MARK_ROW}"] = "" if column_letter in {"A", "B", "C", "D"} else "итого"

    for offset, day in enumerate(payload["days"]):
        column_letter = get_column_letter(DAY_COLUMN_START + offset)
        worksheet[f"{column_letter}{HEADER_ROW}"] = day["day"]
        worksheet[f"{column_letter}{DAY_MARK_ROW}"] = "З/О"


def _write_rows(worksheet, payload: dict, row_count: int) -> None:
    rows = payload["rows"]
    for offset in range(row_count):
        row_index = DATA_START_ROW + offset
        row = rows[offset] if offset < len(rows) else None
        if row is None:
            continue

        worksheet[f"A{row_index}"] = row["index"]
        worksheet[f"B{row_index}"] = row["student_name"]
        worksheet[f"C{row_index}"] = row["group_name"]
        worksheet[f"D{row_index}"] = row["category_name"]
        worksheet[f"{BREAKFAST_TOTAL_COLUMN}{row_index}"] = row["breakfast_count"]
        worksheet[f"{LUNCH_TOTAL_COLUMN}{row_index}"] = row["lunch_count"]
        worksheet[f"{AMOUNT_TOTAL_COLUMN}{row_index}"] = row["total_amount"]

        for day_offset, day in enumerate(payload["days"]):
            column_letter = get_column_letter(DAY_COLUMN_START + day_offset)
            worksheet[f"{column_letter}{row_index}"] = row["marks"].get(day["iso"], "")


def _write_totals(worksheet, payload: dict, summary_start_row: int) -> None:
    total_rows = (
        (
            "ИТОГО завтраков",
            "breakfast",
            payload["meal_totals"]["breakfast"]["count"],
            None,
            payload["meal_totals"]["breakfast"]["amount"],
        ),
        (
            "ИТОГО обедов",
            "lunch",
            None,
            payload["meal_totals"]["lunch"]["count"],
            payload["meal_totals"]["lunch"]["amount"],
        ),
        (
            "ИТОГО всего",
            "total",
            payload["meal_totals"]["breakfast"]["count"],
            payload["meal_totals"]["lunch"]["count"],
            payload["total_amount"],
        ),
    )

    for offset, (label, meal_key, breakfast_total, lunch_total, amount_total) in enumerate(total_rows):
        row_index = summary_start_row + offset
        worksheet[f"B{row_index}"] = label
        worksheet[f"{BREAKFAST_TOTAL_COLUMN}{row_index}"] = breakfast_total
        worksheet[f"{LUNCH_TOTAL_COLUMN}{row_index}"] = lunch_total
        worksheet[f"{AMOUNT_TOTAL_COLUMN}{row_index}"] = amount_total
        for day_offset, day in enumerate(payload["days"]):
            column_letter = get_column_letter(DAY_COLUMN_START + day_offset)
            if meal_key == "total":
                value = payload["day_totals"][day["iso"]]["count"]
            else:
                value = payload["day_totals"][day["iso"]][meal_key]["count"]
            worksheet[f"{column_letter}{row_index}"] = value or ""


def _write_signature(worksheet, payload: dict, config: CombinedMealSheetConfig) -> None:
    worksheet.merge_cells(f"A{int(config.prepared_by_binding.cell[1:])}:{AMOUNT_TOTAL_COLUMN}{int(config.prepared_by_binding.cell[1:])}")
    worksheet[config.prepared_by_binding.cell] = (
        f"{config.prepared_by_binding.prefix}{payload['prepared_by_short_name']}"
    )


def _style_document(worksheet, signature_row: int) -> None:
    thin = Side(style="thin", color="000000")
    border = Border(top=thin, right=thin, bottom=thin, left=thin)
    header_fill = PatternFill("solid", fgColor="EAF2F8")
    summary_fill = PatternFill("solid", fgColor="F4F6F7")

    worksheet["A1"].font = Font(name="Arial", size=10, bold=True)
    worksheet["A2"].font = Font(name="Arial", size=14, bold=True)
    worksheet["A3"].font = Font(name="Arial", size=11, bold=True)
    for row_index in (1, 2, 3):
        worksheet[f"A{row_index}"].alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    worksheet.row_dimensions[2].height = 28

    for row in worksheet.iter_rows(min_row=HEADER_ROW, max_row=signature_row - 2, min_col=1, max_col=38):
        for cell in row:
            cell.font = Font(name="Arial", size=8)
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = border

    for row_index in (HEADER_ROW, DAY_MARK_ROW):
        for cell in worksheet[row_index]:
            cell.font = Font(name="Arial", size=8, bold=True)
            cell.fill = header_fill
        worksheet.row_dimensions[row_index].height = 24 if row_index == HEADER_ROW else 18

    for row_index in range(DATA_START_ROW, signature_row - 4):
        worksheet[f"B{row_index}"].alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
        worksheet[f"D{row_index}"].alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
        worksheet.row_dimensions[row_index].height = 18

    for row_index in range(signature_row - 4, signature_row - 1):
        for cell in worksheet[row_index]:
            cell.font = Font(name="Arial", size=8, bold=True)
            cell.fill = summary_fill
        worksheet[f"B{row_index}"].alignment = Alignment(horizontal="left", vertical="center")

    for row_index in range(DATA_START_ROW, signature_row - 1):
        worksheet[f"{AMOUNT_TOTAL_COLUMN}{row_index}"].number_format = "0.00"

    signature_cell = worksheet[f"A{signature_row}"]
    signature_cell.font = Font(name="Arial", size=10)
    signature_cell.alignment = Alignment(horizontal="left", vertical="center")
    worksheet.row_dimensions[signature_row].height = 24


def _safe_sheet_title(value: str) -> str:
    cleaned = "".join("_" if char in "\\/*?:[]" else char for char in value)
    return cleaned[:31]
