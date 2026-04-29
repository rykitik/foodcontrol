from __future__ import annotations

from datetime import date, timedelta

import app.services.meal_confirmation as meal_confirmation_service
from app.models import MealRecord, MealSelectionRequest, Student, Ticket, User, db
from app.services.meals import build_meal_selection_request_fingerprint


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
    return response


def meal_confirm_payload(student_card: str, service_day: date, request_id: str, selected_meals: list[str]) -> dict:
    return {
        "code": student_card,
        "issue_date": service_day.isoformat(),
        "request_id": request_id,
        "selected_meals": selected_meals,
    }


def get_active_ticket(student_id: str, service_day: date) -> Ticket:
    ticket = Ticket.query.filter_by(
        student_id=student_id,
        month=service_day.month,
        year=service_day.year,
        status="active",
    ).first()
    assert ticket is not None
    return ticket


def get_user(username: str) -> User:
    user = User.query.filter_by(username=username).first()
    assert user is not None
    return user


def test_confirm_selection_requires_request_id(client):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))
    student = get_student(client, social_headers, "100001")
    meal_type = student["category"]["meal_types"][0]

    create_ticket_for_student(client, social_headers, student["id"], service_day)

    response = client.post(
        "/api/meals/confirm-selection",
        headers=cashier_headers,
        json={
            "code": student["student_card"],
            "issue_date": service_day.isoformat(),
            "selected_meals": [meal_type],
        },
    )

    assert response.status_code == 400
    assert "request_id" in response.get_json()["error"]


def test_confirm_selection_replays_successful_request_safely(client, app):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))
    student = get_student(client, social_headers, "100001")
    meal_type = student["category"]["meal_types"][0]

    create_ticket_for_student(client, social_headers, student["id"], service_day)

    request_id = "meal-confirm-success-replay"
    payload = meal_confirm_payload(student["student_card"], service_day, request_id, [meal_type])

    first_response = client.post("/api/meals/confirm-selection", headers=cashier_headers, json=payload)
    assert first_response.status_code == 201

    repeat_response = client.post("/api/meals/confirm-selection", headers=cashier_headers, json=payload)
    assert repeat_response.status_code == 200
    assert repeat_response.get_json() == first_response.get_json()

    with app.app_context():
        stored_request = MealSelectionRequest.query.filter_by(request_id=request_id).first()
        assert stored_request is not None
        assert stored_request.response_status == 201
        assert MealRecord.query.filter_by(ticket_id=stored_request.ticket_id, issue_date=service_day, meal_type=meal_type).count() == 1


def test_confirm_selection_rejects_request_id_reuse_with_different_payload(client):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))

    students = client.get("/api/students/search", headers=social_headers).get_json()["data"]
    student = next((item for item in students if len(item["category"]["meal_types"]) > 1), students[0])
    first_meal = student["category"]["meal_types"][0]
    mismatch_meal = "lunch" if first_meal != "lunch" else "breakfast"
    create_ticket_for_student(client, social_headers, student["id"], service_day)

    request_id = "meal-confirm-fingerprint-mismatch"
    first_payload = meal_confirm_payload(student["student_card"], service_day, request_id, [first_meal])
    first_response = client.post("/api/meals/confirm-selection", headers=cashier_headers, json=first_payload)
    assert first_response.status_code == 201

    mismatch_payload = meal_confirm_payload(student["student_card"], service_day, request_id, [first_meal, mismatch_meal])
    mismatch_response = client.post("/api/meals/confirm-selection", headers=cashier_headers, json=mismatch_payload)

    assert mismatch_response.status_code == 409
    assert mismatch_response.get_json()["data"]["request_id"] == request_id


def test_confirm_selection_returns_processing_conflict_for_pending_request(client, app):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))
    request_id = "meal-confirm-pending-request"
    student = get_student(client, social_headers, "100001")
    meal_type = student["category"]["meal_types"][0]

    create_ticket_for_student(client, social_headers, student["id"], service_day)
    payload = meal_confirm_payload(student["student_card"], service_day, request_id, [meal_type])

    with app.app_context():
        ticket = get_active_ticket(student["id"], service_day)
        cashier = get_user("cashier1")
        db.session.add(
            MealSelectionRequest(
                request_id=request_id,
                request_fingerprint=build_meal_selection_request_fingerprint(payload, [meal_type]),
                ticket_id=ticket.id,
                issue_date=service_day,
                created_by=cashier.id,
            )
        )
        db.session.commit()

    response = client.post("/api/meals/confirm-selection", headers=cashier_headers, json=payload)

    assert response.status_code == 409
    response_payload = response.get_json()
    assert response_payload["data"]["request_id"] == request_id
    assert response_payload["error"]


def test_confirm_selection_maps_duplicate_meal_integrity_conflict_to_409(client, app, monkeypatch):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))
    request_id = "meal-confirm-db-duplicate"
    student = get_student(client, social_headers, "100001")
    meal_type = student["category"]["meal_types"][0]

    create_ticket_for_student(client, social_headers, student["id"], service_day)

    with app.app_context():
        ticket = get_active_ticket(student["id"], service_day)
        cashier = get_user("cashier1")
        db.session.add(
            MealRecord(
                ticket_id=ticket.id,
                student_id=student["id"],
                meal_type=meal_type,
                issue_date=service_day,
                issued_by=cashier.id,
                building_id=1,
                price=1,
            )
        )
        db.session.commit()

    monkeypatch.setattr(meal_confirmation_service, "build_day_statuses", lambda *_args, **_kwargs: ([], [], [meal_type], 0.0))

    payload = meal_confirm_payload(student["student_card"], service_day, request_id, [meal_type])
    response = client.post("/api/meals/confirm-selection", headers=cashier_headers, json=payload)

    assert response.status_code == 409
    response_payload = response.get_json()["data"]
    assert response_payload["issued_meals"] == []
    assert meal_type in response_payload["already_issued_meals"]

    with app.app_context():
        stored_request = MealSelectionRequest.query.filter_by(request_id=request_id).first()
        ticket = get_active_ticket(student["id"], service_day)
        assert stored_request is not None
        assert stored_request.response_status == 409
        assert MealRecord.query.filter_by(ticket_id=ticket.id, issue_date=service_day, meal_type=meal_type).count() == 1


def test_confirm_selection_replays_controlled_conflict_response(client, app):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))
    request_id = "meal-confirm-conflict-replay"
    student = get_student(client, social_headers, "100001")
    meal_type = student["category"]["meal_types"][0]

    create_ticket_for_student(client, social_headers, student["id"], service_day)

    with app.app_context():
        ticket = get_active_ticket(student["id"], service_day)
        cashier = get_user("cashier1")
        db.session.add(
            MealRecord(
                ticket_id=ticket.id,
                student_id=student["id"],
                meal_type=meal_type,
                issue_date=service_day,
                issued_by=cashier.id,
                building_id=1,
                price=1,
            )
        )
        db.session.commit()

    payload = meal_confirm_payload(student["student_card"], service_day, request_id, [meal_type])
    first_response = client.post("/api/meals/confirm-selection", headers=cashier_headers, json=payload)
    assert first_response.status_code == 409

    repeat_response = client.post("/api/meals/confirm-selection", headers=cashier_headers, json=payload)
    assert repeat_response.status_code == 409
    assert repeat_response.get_json() == first_response.get_json()


def test_confirm_selection_rejects_inactive_student_with_active_ticket(client, app):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))
    request_id = "meal-confirm-inactive-student"
    student = get_student(client, social_headers, "100001")
    meal_type = student["category"]["meal_types"][0]

    create_ticket_for_student(client, social_headers, student["id"], service_day)

    with app.app_context():
        student_record = db.session.get(Student, student["id"])
        assert student_record is not None
        student_record.is_active = False
        db.session.commit()

    payload = meal_confirm_payload(student["student_card"], service_day, request_id, [meal_type])
    response = client.post("/api/meals/confirm-selection", headers=cashier_headers, json=payload)

    assert response.status_code == 409
    assert "выключен" in response.get_json()["error"].lower()

    with app.app_context():
        ticket = get_active_ticket(student["id"], service_day)
        assert MealRecord.query.filter_by(ticket_id=ticket.id, issue_date=service_day).count() == 0
