from __future__ import annotations

from app.services.accounting_documents.template_config import (
    resolve_cost_calculation_template,
    resolve_cost_statement_template,
    resolve_meal_sheet_template,
)
from test_accountant_document_forms import (
    editable_metadata_by_key,
    login,
    prepare_accounting_records,
    prepared_by_cell_text,
    workbook_cell_display_value,
    workbook_from_response,
)


def editable_metadata_values(payload: dict) -> dict[str, str]:
    return {field["key"]: field["value"] for field in payload["editable_metadata"]}


def test_accountant_cost_statement_shared_metadata_overrides_apply_for_all_users(client, app):
    accountant_headers = login(client, "accountant")
    admin_headers = login(client, "admin")
    prepared = prepare_accounting_records(
        client,
        app,
        student_card="210001",
        category_code="low_income",
        full_name="Фролова Светлана Викторовна",
        group_name="БУХ-41",
        meal_types=("lunch",),
    )
    config = resolve_cost_statement_template("low_income")

    original_response = client.post(
        "/api/reports/accounting-documents/cost-statement/document",
        headers=accountant_headers,
        json={
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
        },
    )
    assert original_response.status_code == 200
    original_payload = original_response.get_json()["data"]
    values = editable_metadata_values(original_payload)
    values["fundingSource"] = "Федеральный бюджет"
    values["preparedByName"] = "Централизованная бухгалтерия"
    values["checkedByName"] = "Петрова П. П."

    save_response = client.post(
        "/api/reports/accounting-documents/metadata/save",
        headers=accountant_headers,
        json={
            "document_kind": "cost_statement",
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
            "values": values,
        },
    )
    assert save_response.status_code == 200
    saved_payload = save_response.get_json()["data"]
    saved_metadata = editable_metadata_by_key(saved_payload)
    assert saved_metadata["fundingSource"]["value"] == "Федеральный бюджет"
    assert saved_metadata["fundingSource"]["isCustom"] is True
    assert saved_metadata["preparedByName"]["value"] == "Централизованная бухгалтерия"
    assert saved_metadata["preparedByName"]["isCustom"] is True
    assert saved_metadata["checkedByName"]["value"] == "Петрова П. П."

    shared_response = client.post(
        "/api/reports/accounting-documents/cost-statement/document",
        headers=admin_headers,
        json={
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
        },
    )
    assert shared_response.status_code == 200
    shared_payload = shared_response.get_json()["data"]
    shared_metadata = editable_metadata_by_key(shared_payload)
    assert shared_metadata["fundingSource"]["value"] == "Федеральный бюджет"
    assert shared_metadata["preparedByName"]["value"] == "Централизованная бухгалтерия"
    assert shared_metadata["checkedByName"]["value"] == "Петрова П. П."

    workbook_response = client.post(
        "/api/reports/accounting-documents/cost-statement/xlsx",
        headers=admin_headers,
        json={
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
        },
    )
    _, sheet = workbook_from_response(workbook_response)

    assert workbook_cell_display_value(sheet, "C15") == "Федеральный бюджет"
    assert workbook_cell_display_value(sheet, config.prepared_by_binding.cell) == "Централизованная бухгалтерия"
    assert workbook_cell_display_value(sheet, "E88") == "Петрова П. П."


def test_accountant_meal_sheet_shared_metadata_overrides_apply_for_all_users(client, app):
    accountant_headers = login(client, "accountant")
    admin_headers = login(client, "admin")
    prepared = prepare_accounting_records(
        client,
        app,
        student_card="210002",
        category_code="ovz",
        full_name="Орлова Дарья Максимовна",
        group_name="ОВЗ-21",
        meal_types=("breakfast", "lunch"),
    )
    config = resolve_meal_sheet_template("ovz", "breakfast")

    original_response = client.post(
        "/api/reports/accounting-documents/meal-sheet/document",
        headers=accountant_headers,
        json={
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
            "meal_type": "breakfast",
        },
    )
    assert original_response.status_code == 200
    original_payload = original_response.get_json()["data"]
    values = editable_metadata_values(original_payload)
    values["institution"] = "Централизованная бухгалтерия колледжа"
    values["preparedByName"] = "Единый бухгалтер"

    save_response = client.post(
        "/api/reports/accounting-documents/metadata/save",
        headers=accountant_headers,
        json={
            "document_kind": "meal_sheet",
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
            "meal_type": "breakfast",
            "values": values,
        },
    )
    assert save_response.status_code == 200

    shared_response = client.post(
        "/api/reports/accounting-documents/meal-sheet/document",
        headers=admin_headers,
        json={
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
            "meal_type": "breakfast",
        },
    )
    assert shared_response.status_code == 200
    shared_payload = shared_response.get_json()["data"]
    shared_metadata = editable_metadata_by_key(shared_payload)
    assert shared_metadata["institution"]["value"] == "Централизованная бухгалтерия колледжа"
    assert shared_metadata["institution"]["isCustom"] is True
    assert shared_metadata["preparedByName"]["value"] == "Единый бухгалтер"
    assert shared_metadata["preparedByName"]["isCustom"] is True

    workbook_response = client.post(
        "/api/reports/accounting-documents/meal-sheet/xlsx",
        headers=admin_headers,
        json={
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
            "meal_type": "breakfast",
        },
    )
    _, sheet = workbook_from_response(workbook_response)

    assert workbook_cell_display_value(sheet, config.institution_cell) == "Централизованная бухгалтерия колледжа"
    assert prepared_by_cell_text(sheet, binding=config.prepared_by_binding) == "Бухгалтер ___________________Единый бухгалтер"


def test_accountant_document_metadata_reset_restores_system_values(client, app):
    accountant_headers = login(client, "accountant")
    prepared = prepare_accounting_records(
        client,
        app,
        student_card="210003",
        category_code="low_income",
        full_name="Крылова Мария Сергеевна",
        group_name="БУХ-51",
        meal_types=("lunch",),
    )

    original_response = client.post(
        "/api/reports/accounting-documents/cost-statement/document",
        headers=accountant_headers,
        json={
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
        },
    )
    assert original_response.status_code == 200
    original_payload = original_response.get_json()["data"]
    original_metadata = editable_metadata_by_key(original_payload)
    original_prepared_by = original_metadata["preparedByName"]["value"]
    values = editable_metadata_values(original_payload)
    values["preparedByName"] = "Temporary accountant"
    values["fundingSource"] = "Муниципальный бюджет"

    save_response = client.post(
        "/api/reports/accounting-documents/metadata/save",
        headers=accountant_headers,
        json={
            "document_kind": "cost_statement",
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
            "values": values,
        },
    )
    assert save_response.status_code == 200

    reset_response = client.post(
        "/api/reports/accounting-documents/metadata/reset",
        headers=accountant_headers,
        json={
            "document_kind": "cost_statement",
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
        },
    )
    assert reset_response.status_code == 200
    reset_payload = reset_response.get_json()["data"]
    reset_metadata = editable_metadata_by_key(reset_payload)
    assert reset_metadata["preparedByName"]["value"] == original_prepared_by
    assert reset_metadata["preparedByName"]["isCustom"] is False

    follow_up_response = client.post(
        "/api/reports/accounting-documents/cost-statement/document",
        headers=accountant_headers,
        json={
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
        },
    )
    assert follow_up_response.status_code == 200
    follow_up_metadata = editable_metadata_by_key(follow_up_response.get_json()["data"])
    assert follow_up_metadata["preparedByName"]["value"] == original_prepared_by
    assert follow_up_metadata["preparedByName"]["isCustom"] is False


def test_accountant_global_metadata_applies_to_preview_and_xlsx(client, app):
    accountant_headers = login(client, "accountant")
    prepared = prepare_accounting_records(
        client,
        app,
        student_card="210004",
        category_code="low_income",
        full_name="Global Metadata Student",
        group_name="BUH-61",
        meal_types=("lunch",),
    )
    config = resolve_cost_statement_template("low_income")
    institution = "Global College Requisites"
    funding_source = "Unified Funding Source"

    save_response = client.post(
        "/api/reports/accounting-documents/global-metadata/save",
        headers=accountant_headers,
        json={
            "values": {
                "institution": institution,
                "fundingSource": funding_source,
            },
        },
    )
    assert save_response.status_code == 200
    assert save_response.get_json()["data"]["values"]["institution"] == institution

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
    metadata = editable_metadata_by_key(payload)
    assert metadata["institution"]["value"] == institution
    assert metadata["fundingSource"]["value"] == funding_source
    assert metadata["institution"]["isCustom"] is True
    assert institution in payload["html"]
    assert funding_source in payload["html"]

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
    assert workbook_cell_display_value(sheet, config.institution_cell) == institution
    assert workbook_cell_display_value(sheet, "C15") == funding_source


def test_accountant_cost_calculation_daily_compensation_override_recalculates_preview_and_xlsx(client, app):
    accountant_headers = login(client, "accountant")
    prepared = prepare_accounting_records(
        client,
        app,
        student_card="210005",
        category_code="orphan",
        full_name="Нормативов Павел Сергеевич",
        group_name="СИР-41",
        meal_types=("lunch",),
    )
    config = resolve_cost_calculation_template("orphan")

    original_response = client.post(
        "/api/reports/accounting-documents/cost-calculation/document",
        headers=accountant_headers,
        json={
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
        },
    )
    assert original_response.status_code == 200
    values = editable_metadata_values(original_response.get_json()["data"])
    values["dailyCompensationRate"] = "400,50"

    save_response = client.post(
        "/api/reports/accounting-documents/metadata/save",
        headers=accountant_headers,
        json={
            "document_kind": "cost_calculation",
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
            "values": values,
        },
    )
    assert save_response.status_code == 200
    saved_payload = save_response.get_json()["data"]
    saved_metadata = editable_metadata_by_key(saved_payload)
    assert saved_metadata["dailyCompensationRate"]["value"] == "400,50"
    assert "400,50" in saved_payload["html"]

    workbook_response = client.post(
        "/api/reports/accounting-documents/cost-calculation/xlsx",
        headers=accountant_headers,
        json={
            "month": prepared["month"],
            "year": prepared["year"],
            "category_id": prepared["category_id"],
        },
    )
    _, sheet = workbook_from_response(workbook_response)

    data_row = config.data_start_row
    study_days = sheet[f"{config.study_days_column}{data_row}"].value
    meal_amount = sheet[f"{config.meal_amount_column}{data_row}"].value
    expected_accrued = round(400.5 * study_days, 2)

    assert workbook_cell_display_value(sheet, config.daily_compensation_rate_cell) == "400,50"
    assert sheet[f"{config.accrued_amount_column}{data_row}"].value == expected_accrued
    assert sheet[f"{config.payout_amount_column}{data_row}"].value == round(expected_accrued - meal_amount, 2)
