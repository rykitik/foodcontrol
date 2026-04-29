from __future__ import annotations

from datetime import date, timedelta
from urllib.parse import quote

from app.utils.ticket_codes import build_ticket_meal_code, parse_ticket_code


def login(client, username: str, password: str = "password123") -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    payload = response.get_json()
    token = payload["data"]["token"]
    return {"Authorization": f"Bearer {token}"}


def first_service_day(reference: date | None = None) -> date:
    current = reference or date.today().replace(day=1)
    while current.weekday() == 6:
        current += timedelta(days=1)
    return current


def test_breakfast_and_lunch_ticket_prints_a_separate_card_for_each_code(client):
    social_headers = login(client, "social1")
    service_day = first_service_day(date.today().replace(day=1))

    students = client.get("/api/students/search?q=100002", headers=social_headers).get_json()["data"]
    student = students[0]

    create_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": service_day.month, "year": service_day.year},
    )
    assert create_response.status_code in {201, 409}

    ticket = (
        create_response.get_json()["data"]
        if create_response.status_code == 201
        else client.get(f"/api/students/{student['id']}/tickets", headers=social_headers).get_json()["data"][0]
    )

    document_response = client.post(f"/api/tickets/{ticket['id']}/document", headers=social_headers)
    assert document_response.status_code == 200

    html = document_response.get_json()["data"]["html"]
    assert html.count('<article class="ticket-print-card ') == 3
    assert html.count("<svg") == 3
    assert "ticket-print-card-detachable" in html
    assert html.count("ticket-print-card-sequence") == 3
    assert "1 из 3" in html
    assert "2 из 3" in html
    assert "3 из 3" in html
    assert "ЗАВТРАК + ОБЕД" in html
    assert "ЗАВТРАК" in html
    assert "ОБЕД" in html
    assert "95 ₽ + 165 ₽" in html
    assert "Корпус" not in html
    assert "data-barcode-payload" in html
    assert "data-scan-code" in html
    assert "-PPRINTCHECK" not in html
    assert "-P" in html
    assert "ticket-sheet-header" in html
    assert "Студентов: 1" in html
    assert "Талонов: 3" in html
    assert "ticket-print-card-triple" not in html
    assert 'class="ticket-print-code"' not in html
    assert 'class="ticket-print-code ticket-print-code-single"' not in html


def test_single_meal_ticket_prints_one_detachable_card(client):
    social_headers = login(client, "social1")
    service_day = first_service_day(date.today().replace(day=1))

    students = client.get("/api/students/search?q=100001", headers=social_headers).get_json()["data"]
    student = students[0]

    create_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": service_day.month, "year": service_day.year},
    )
    assert create_response.status_code in {201, 409}

    ticket = (
        create_response.get_json()["data"]
        if create_response.status_code == 201
        else client.get(f"/api/students/{student['id']}/tickets", headers=social_headers).get_json()["data"][0]
    )

    document_response = client.post(f"/api/tickets/{ticket['id']}/document", headers=social_headers)
    assert document_response.status_code == 200

    html = document_response.get_json()["data"]["html"]
    assert html.count('<article class="ticket-print-card ') == 1
    assert html.count("<svg") == 1
    assert "ticket-print-card-detachable" in html
    assert "ticket-print-card-sequence" in html
    assert "1 из 1" in html
    assert "Корпус" not in html
    assert "ticket-print-card-triple" not in html
    assert 'class="ticket-print-code"' not in html
    assert 'class="ticket-print-code ticket-print-code-single"' not in html


def test_resolve_and_confirm_respect_ticket_meal_hint_codes(client):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))

    students = client.get("/api/students/search?q=100002", headers=social_headers).get_json()["data"]
    student = students[0]

    create_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": service_day.month, "year": service_day.year},
    )
    assert create_response.status_code in {201, 409}

    ticket = (
        create_response.get_json()["data"]
        if create_response.status_code == 201
        else client.get(f"/api/students/{student['id']}/tickets", headers=social_headers).get_json()["data"][0]
    )

    breakfast_code = build_ticket_meal_code(ticket["qr_code"], ["breakfast"])
    combo_code = build_ticket_meal_code(ticket["qr_code"], ["breakfast", "lunch"])
    print_combo_code = f"{combo_code}-P{ticket['start_date'].replace('-', '')}{ticket['end_date'].replace('-', '')}-TPRINTCHECK"

    breakfast_lookup = client.get(f"/api/meals/resolve?query={breakfast_code}", headers=cashier_headers)
    assert breakfast_lookup.status_code == 200
    breakfast_payload = breakfast_lookup.get_json()["data"]
    assert breakfast_payload["scan_meal_hint"] == ["breakfast"]
    assert breakfast_payload["remaining_meals"] == ["breakfast"]

    parsed_print_code = parse_ticket_code(print_combo_code)
    assert parsed_print_code is not None
    assert parsed_print_code.base_code == ticket["qr_code"]
    assert parsed_print_code.meal_hint == ("breakfast", "lunch")

    print_lookup = client.get(f"/api/meals/resolve?query={quote(print_combo_code)}", headers=cashier_headers)
    assert print_lookup.status_code == 200
    assert print_lookup.get_json()["data"]["scan_meal_hint"] == ["breakfast", "lunch"]

    invalid_confirm = client.post(
        "/api/meals/confirm-selection",
        headers=cashier_headers,
        json={
            "code": breakfast_code,
            "issue_date": service_day.isoformat(),
            "request_id": "breakfast-only-invalid",
            "selected_meals": ["lunch"],
        },
    )
    assert invalid_confirm.status_code == 409

    combo_confirm = client.post(
        "/api/meals/confirm-selection",
        headers=cashier_headers,
        json={
            "code": combo_code,
            "issue_date": service_day.isoformat(),
            "request_id": "breakfast-lunch-combo",
            "selected_meals": ["breakfast", "lunch"],
        },
    )
    assert combo_confirm.status_code == 201
    combo_payload = combo_confirm.get_json()["data"]
    assert set(combo_payload["issued_meals"]) == {"breakfast", "lunch"}


def test_reissued_ticket_old_code_is_marked_inactive_on_lookup(client):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))

    students = client.get("/api/students/search?q=100002", headers=social_headers).get_json()["data"]
    student = students[0]

    create_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": service_day.month, "year": service_day.year},
    )
    assert create_response.status_code in {201, 409}

    ticket = (
        create_response.get_json()["data"]
        if create_response.status_code == 201
        else client.get(f"/api/students/{student['id']}/tickets", headers=social_headers).get_json()["data"][0]
    )

    old_code = build_ticket_meal_code(ticket["qr_code"], ["breakfast", "lunch"])
    reissue_response = client.post(f"/api/tickets/{ticket['id']}/reissue", headers=social_headers)
    assert reissue_response.status_code == 201

    lookup_response = client.get(f"/api/meals/resolve?query={old_code}", headers=cashier_headers)
    assert lookup_response.status_code == 200
    lookup_payload = lookup_response.get_json()["data"]
    assert lookup_payload["ticket"]["id"] == ticket["id"]
    assert lookup_payload["ticket"]["status"] != "active"
    assert lookup_payload["remaining_meals"] == []

    confirm_response = client.post(
        "/api/meals/confirm-selection",
        headers=cashier_headers,
        json={
            "code": old_code,
            "issue_date": service_day.isoformat(),
            "request_id": "old-reissued-ticket",
            "selected_meals": ["breakfast"],
        },
    )
    assert confirm_response.status_code == 409
