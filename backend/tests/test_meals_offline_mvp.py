from __future__ import annotations
from datetime import date, timedelta

import app.routes.meals as meals_route
from app.models import Ticket, User
from app.services.cashier_offline_snapshot import build_cashier_offline_snapshot



def login(client, username: str, password: str = "password123") -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    token = response.get_json()["data"]["token"]
    return {"Authorization": f"Bearer {token}"}


def first_service_day(reference: date | None = None) -> date:
    current = reference or date.today().replace(day=1)
    while current.weekday() == 6:
        current += timedelta(days=1)
    return current


def get_student(client, headers, query: str):
    response = client.get(f"/api/students/search?q={query}", headers=headers)
    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload
    return payload[0]


def create_ticket_for_student(client, headers, student_id: str, service_day: date):
    response = client.post(
        "/api/tickets",
        headers=headers,
        json={"student_id": student_id, "month": service_day.month, "year": service_day.year},
    )
    assert response.status_code in {201, 409}


def test_offline_snapshot_is_cashier_only(client):
    cashier_headers = login(client, "cashier1")
    admin_headers = login(client, "admin")

    cashier_response = client.get("/api/meals/offline-snapshot", headers=cashier_headers)
    assert cashier_response.status_code == 200

    payload = cashier_response.get_json()["data"]
    assert payload["datasets"]["students"]
    assert payload["datasets"]["categories"]
    assert payload["rules"]["supported_meal_types"] == ["breakfast", "lunch"]

    admin_response = client.get("/api/meals/offline-snapshot", headers=admin_headers)
    assert admin_response.status_code == 403


def test_offline_snapshot_carries_today_issue_statuses_for_terminal_decisions(client, app):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")

    service_day = first_service_day(date.today().replace(day=1))
    student = get_student(client, social_headers, "100001")
    meal_type = student["category"]["meal_types"][0]

    create_ticket_for_student(client, social_headers, student["id"], service_day)

    confirm_response = client.post(
        "/api/meals/confirm-selection",
        headers=cashier_headers,
        json={
            "code": student["student_card"],
            "issue_date": service_day.isoformat(),
            "request_id": "offline-snapshot-issued-status",
            "selected_meals": [meal_type],
        },
    )
    assert confirm_response.status_code == 201

    with app.app_context():
        cashier = User.query.filter_by(username="cashier1").first()
        assert cashier is not None
        payload = build_cashier_offline_snapshot(
            cashier,
            configured_holidays=None,
            target_date=service_day,
        )

    ticket = next(item for item in payload["datasets"]["tickets"] if item["student_id"] == student["id"])
    issue_status = next(item for item in ticket["today_statuses"] if item["meal_type"] == meal_type)

    assert issue_status["issued"] is True
    assert issue_status["issue_time"] is not None
    assert ticket["issued_today_amount"] > 0


def test_offline_snapshot_carries_cross_building_lookup_restrictions(client, app):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))
    student = get_student(client, social_headers, "100001")

    create_ticket_for_student(client, social_headers, student["id"], service_day)
    assign_response = client.patch(
        f"/api/students/{student['id']}",
        headers=social_headers,
        json={"meal_building_id": 2},
    )
    assert assign_response.status_code == 200

    with app.app_context():
        cashier = User.query.filter_by(username="cashier1").first()
        assert cashier is not None
        ticket = (
            Ticket.query.filter_by(student_id=student["id"], status="active")
            .order_by(Ticket.created_at.desc())
            .first()
        )
        assert ticket is not None
        payload = build_cashier_offline_snapshot(
            cashier,
            configured_holidays=None,
            target_date=service_day,
        )

    assert all(item["id"] != student["id"] for item in payload["datasets"]["students"])
    restrictions = payload["datasets"]["lookup_restrictions"]
    student_card_restriction = next(
        item
        for item in restrictions
        if item["lookup_kind"] == "student_card" and item["lookup_key"] == student["student_card"]
    )
    ticket_qr_restriction = next(
        item
        for item in restrictions
        if item["lookup_kind"] == "qr_code" and item["lookup_key"] == ticket.qr_code
    )

    assert student_card_restriction["effective_meal_building_id"] == 2
    assert student_card_restriction["effective_meal_building_name"] == "Корпус 2, Яковлева, д.17"
    assert ticket_qr_restriction["reason"] == "cross_building"


def test_offline_sync_classifies_acked_and_needs_review(client):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")

    service_day = first_service_day(date.today().replace(day=1))
    student = get_student(client, social_headers, "100001")
    meal_type = student["category"]["meal_types"][0]

    create_ticket_for_student(client, social_headers, student["id"], service_day)

    request_id = "offline-sync-mixed-result"
    response = client.post(
        "/api/meals/offline-sync",
        headers=cashier_headers,
        json={
            "items": [
                {
                    "client_item_id": "first",
                    "request": {
                        "code": student["student_card"],
                        "issue_date": service_day.isoformat(),
                        "request_id": request_id,
                        "selected_meals": [meal_type],
                    },
                },
                {
                    "client_item_id": "second",
                    "request": {
                        "code": student["student_card"],
                        "issue_date": service_day.isoformat(),
                        "request_id": request_id,
                        "selected_meals": [meal_type, "lunch" if meal_type != "lunch" else "breakfast"],
                    },
                },
            ]
        },
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    summary = payload["summary"]
    assert summary["acked"] == 1
    assert summary["needs_review"] == 1
    assert summary["rejected"] == 0

    results = {item["client_item_id"]: item for item in payload["results"]}
    assert results["first"]["status"] == "acked"
    assert results["second"]["status"] == "needs_review"


def test_offline_sync_rejects_invalid_items_shape(client):
    cashier_headers = login(client, "cashier1")

    response = client.post(
        "/api/meals/offline-sync",
        headers=cashier_headers,
        json={"items": {"request_id": "invalid-shape"}},
    )
    assert response.status_code == 400


def test_offline_sync_classifies_validation_error_as_rejected(client):
    cashier_headers = login(client, "cashier1")

    response = client.post(
        "/api/meals/offline-sync",
        headers=cashier_headers,
        json={
            "items": [
                {
                    "client_item_id": "invalid-payload",
                    "request": {
                        "code": "",
                        "request_id": "invalid-payload",
                        "selected_meals": [],
                    },
                }
            ]
        },
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["summary"]["rejected"] == 1
    assert payload["results"][0]["status"] == "rejected"


def test_offline_sync_uses_service_core_without_route_reentry(client, monkeypatch):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")

    service_day = first_service_day(date.today().replace(day=1))
    student = get_student(client, social_headers, "100001")
    meal_type = student["category"]["meal_types"][0]

    create_ticket_for_student(client, social_headers, student["id"], service_day)

    def fail_if_confirm_route_is_reused(*_args, **_kwargs):
        raise AssertionError("offline sync must not call confirm route internals")

    monkeypatch.setattr(meals_route, "confirm_meal_selection", fail_if_confirm_route_is_reused)

    response = client.post(
        "/api/meals/offline-sync",
        headers=cashier_headers,
        json={
            "items": [
                {
                    "client_item_id": "service-core",
                    "request": {
                        "code": student["student_card"],
                        "issue_date": service_day.isoformat(),
                        "request_id": "offline-sync-service-core",
                        "selected_meals": [meal_type],
                    },
                }
            ]
        },
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["summary"]["acked"] == 1
    assert payload["results"][0]["status"] == "acked"

