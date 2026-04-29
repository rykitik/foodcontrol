from __future__ import annotations

import re

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, PatternFill, Side

from app.models import Category
from app.services.accounting_documents.worksheet_layout import merged_maps, overflow_visible_cells


def _login(client, username: str, password: str = "password123") -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    token = response.get_json()["data"]["token"]
    return {"Authorization": f"Bearer {token}"}


def _category_id_by_code(app, code: str) -> int:
    with app.app_context():
        category = Category.query.filter_by(code=code).first()
        assert category is not None
        return int(category.id)


def test_preview_overflow_ignores_cells_with_borders_or_fill():
    workbook = Workbook()
    sheet = workbook.active

    for row_index in range(1, 4):
        sheet.cell(row=row_index, column=1, value=None)
        target = sheet.cell(row=row_index, column=2, value="МЦК - ЧЭМК Минобразования Чувашии")
        target.alignment = Alignment(horizontal="right")

    sheet["B2"].border = Border(left=Side(style="thin"))
    sheet["B3"].fill = PatternFill("solid", fgColor="D9EAF7")

    visible_rows = [1, 2, 3]
    visible_columns = [1, 2]
    merged_tops, merged_children = merged_maps(sheet, visible_rows, visible_columns)

    overflow = overflow_visible_cells(
        sheet,
        visible_rows,
        visible_columns,
        merged_tops,
        merged_children,
    )

    assert overflow[(1, 2)] == "left"
    assert (2, 2) not in overflow
    assert (3, 2) not in overflow


def test_meal_sheet_preview_exposes_row_and_overflow_attributes(client, app):
    accountant_headers = _login(client, "accountant")
    category_id = _category_id_by_code(app, "ovz")

    response = client.post(
        "/api/reports/accounting-documents/meal-sheet/document",
        headers=accountant_headers,
        json={
            "month": 2,
            "year": 2025,
            "category_id": category_id,
            "meal_type": "breakfast",
        },
    )

    assert response.status_code == 200
    html = response.get_json()["data"]["html"]

    assert 'data-accounting-row="7"' in html
    assert 'data-accounting-row-height-mm="' in html
    assert re.search(
        r'data-accounting-cell="AR7"[^>]*data-accounting-overflow="left"|'
        r'data-accounting-overflow="left"[^>]*data-accounting-cell="AR7"',
        html,
    )
