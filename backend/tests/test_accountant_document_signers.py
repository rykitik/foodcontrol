from __future__ import annotations

from datetime import date, datetime

import pytest

from app.services.accounting_documents.template_config import (
    resolve_cost_calculation_template,
    resolve_cost_statement_template,
    resolve_meal_sheet_template,
)
from test_accountant_document_forms import (
    expected_prepared_by_cell_text,
    login,
    prepare_accounting_records,
    prepared_by_cell_text,
    visible_sheet_text,
    workbook_from_response,
)


@pytest.mark.parametrize(
    ("username", "expected_short_name"),
    [
        ("accountant", "Кузнецова А. С."),
        ("headsocial", "Иванова Т. А."),
        ("admin", "Администратор"),
    ],
)
def test_accountant_meal_sheet_uses_current_user_as_preparer(client, app, username: str, expected_short_name: str):
    headers = login(client, username)
    prepared = prepare_accounting_records(client, app, student_card="100002", meal_types=("breakfast", "lunch"))
    config = resolve_meal_sheet_template("ovz", "breakfast")

    document_response = client.post(
        "/api/reports/accounting-documents/meal-sheet/document",
        headers=headers,
        json={
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
            "meal_type": "breakfast",
        },
    )

    assert document_response.status_code == 200
    payload = document_response.get_json()["data"]
    assert expected_short_name in payload["html"]
    assert "А. И. Ржанова" not in payload["html"]

    workbook_response = client.post(
        "/api/reports/accounting-documents/meal-sheet/xlsx",
        headers=headers,
        json={
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
            "meal_type": "breakfast",
        },
    )

    _, sheet = workbook_from_response(workbook_response)
    visible_text = visible_sheet_text(sheet)

    assert prepared_by_cell_text(sheet, binding=config.prepared_by_binding) == expected_prepared_by_cell_text(
        binding=config.prepared_by_binding,
        short_name=expected_short_name,
    )
    assert expected_short_name.lower() in visible_text
    assert "а. и. ржанова" not in visible_text


@pytest.mark.parametrize(
    ("username", "expected_short_name"),
    [
        ("accountant", "Кузнецова А. С."),
        ("headsocial", "Иванова Т. А."),
        ("admin", "Администратор"),
    ],
)
def test_accountant_cost_statement_uses_current_user_as_preparer(client, app, username: str, expected_short_name: str):
    headers = login(client, username)
    prepared = prepare_accounting_records(
        client,
        app,
        student_card="200001",
        category_code="low_income",
        full_name="Смирнова Анна Олеговна",
        group_name="БУХ-11",
        meal_types=("lunch",),
    )
    config = resolve_cost_statement_template("low_income")

    document_response = client.post(
        "/api/reports/accounting-documents/cost-statement/document",
        headers=headers,
        json={
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
        },
    )

    assert document_response.status_code == 200
    payload = document_response.get_json()["data"]
    assert expected_short_name in payload["html"]
    assert "А. И. Ржанова" not in payload["html"]

    workbook_response = client.post(
        "/api/reports/accounting-documents/cost-statement/xlsx",
        headers=headers,
        json={
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
        },
    )

    _, sheet = workbook_from_response(workbook_response)
    visible_text = visible_sheet_text(sheet)

    assert prepared_by_cell_text(sheet, binding=config.prepared_by_binding) == expected_prepared_by_cell_text(
        binding=config.prepared_by_binding,
        short_name=expected_short_name,
    )
    assert expected_short_name.lower() in visible_text
    assert "а. и. ржанова" not in visible_text


@pytest.mark.parametrize(
    ("username", "expected_short_name"),
    [
        ("accountant", "Кузнецова А. С."),
        ("headsocial", "Иванова Т. А."),
        ("admin", "Администратор"),
    ],
)
def test_accountant_cost_calculation_uses_current_user_as_preparer(client, app, username: str, expected_short_name: str):
    headers = login(client, username)
    prepared = prepare_accounting_records(client, app, student_card="100001", meal_types=("lunch",))
    config = resolve_cost_calculation_template("orphan")

    document_response = client.post(
        "/api/reports/accounting-documents/cost-calculation/document",
        headers=headers,
        json={
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
        },
    )

    assert document_response.status_code == 200
    payload = document_response.get_json()["data"]
    assert expected_short_name in payload["html"]
    assert "Л.И.Матвеева" not in payload["html"]

    workbook_response = client.post(
        "/api/reports/accounting-documents/cost-calculation/xlsx",
        headers=headers,
        json={
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
        },
    )

    _, sheet = workbook_from_response(workbook_response)
    visible_text = visible_sheet_text(sheet)

    assert prepared_by_cell_text(sheet, binding=config.prepared_by_binding) == expected_prepared_by_cell_text(
        binding=config.prepared_by_binding,
        short_name=expected_short_name,
    )
    assert expected_short_name.lower() in visible_text
    assert "л.и.матвеева" not in visible_text


def test_accountant_cost_statement_uses_generation_date_for_report_date(client, app):
    accountant_headers = login(client, "accountant")
    prepared = prepare_accounting_records(
        client,
        app,
        student_card="200001",
        category_code="low_income",
        full_name="Смирнова Анна Олеговна",
        group_name="БУХ-11",
        meal_types=("lunch",),
    )
    config = resolve_cost_statement_template("low_income")
    generation_date = date.today()

    document_response = client.post(
        "/api/reports/accounting-documents/cost-statement/document",
        headers=accountant_headers,
        json={
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
        },
    )

    assert document_response.status_code == 200
    payload = document_response.get_json()["data"]
    assert generation_date.strftime("%d.%m.%Y") in payload["html"]

    workbook_response = client.post(
        "/api/reports/accounting-documents/cost-statement/xlsx",
        headers=accountant_headers,
        json={
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
        },
    )

    _, sheet = workbook_from_response(workbook_response)
    report_date_value = sheet[config.report_date_cell].value
    if isinstance(report_date_value, datetime):
        report_date_value = report_date_value.date()

    assert report_date_value == generation_date
