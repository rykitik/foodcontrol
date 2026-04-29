from __future__ import annotations

from datetime import date, datetime, timedelta

import app.routes.meals as meals_route
from app.models import MealRecord, Ticket, User, db


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


def get_multi_meal_student(client, headers):
    students = client.get("/api/students/search", headers=headers).get_json()["data"]
    student = next((item for item in students if len(item["category"]["meal_types"]) > 1), None)
    assert student is not None
    return student


def create_ticket_for_student(client, headers, student_id: str, service_day: date):
    response = client.post(
        "/api/tickets",
        headers=headers,
        json={"student_id": student_id, "month": service_day.month, "year": service_day.year},
    )
    assert response.status_code in {201, 409}
    return response


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


def insert_meal_record(student_id: str, meal_type: str, service_day: date, *, building_id: int = 1) -> None:
    ticket = get_active_ticket(student_id, service_day)
    cashier = get_user("cashier1")
    db.session.add(
        MealRecord(
            ticket_id=ticket.id,
            student_id=student_id,
            meal_type=meal_type,
            issue_date=service_day,
            issue_time=datetime.now().time().replace(microsecond=0),
            issued_by=cashier.id,
            building_id=building_id,
            price=1,
        )
    )
    db.session.commit()


def test_record_meal_returns_409_for_repeated_request(client, app):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))
    student = get_student(client, social_headers, "100001")
    meal_type = student["category"]["meal_types"][0]

    create_ticket_for_student(client, social_headers, student["id"], service_day)

    first_response = client.post(
        "/api/meals/record",
        headers=cashier_headers,
        json={"code": student["student_card"], "meal_type": meal_type, "issue_date": service_day.isoformat()},
    )
    repeat_response = client.post(
        "/api/meals/record",
        headers=cashier_headers,
        json={"code": student["student_card"], "meal_type": meal_type, "issue_date": service_day.isoformat()},
    )

    assert first_response.status_code == 201
    assert repeat_response.status_code == 409
    assert "error" in repeat_response.get_json()

    with app.app_context():
        ticket = get_active_ticket(student["id"], service_day)
        assert MealRecord.query.filter_by(ticket_id=ticket.id, issue_date=service_day, meal_type=meal_type).count() == 1


def test_record_meal_maps_integrity_conflict_to_409(client, app, monkeypatch):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))
    student = get_student(client, social_headers, "100001")
    meal_type = student["category"]["meal_types"][0]

    create_ticket_for_student(client, social_headers, student["id"], service_day)

    with app.app_context():
        insert_meal_record(student["id"], meal_type, service_day)

    original_find_duplicate = meals_route.find_meal_record_duplicate
    calls = {"count": 0}

    def stale_find_duplicate(ticket_id: str, issue_date: date, current_meal_type: str):
        calls["count"] += 1
        if calls["count"] == 1:
            return None
        return original_find_duplicate(ticket_id, issue_date, current_meal_type)

    monkeypatch.setattr(meals_route, "find_meal_record_duplicate", stale_find_duplicate)

    response = client.post(
        "/api/meals/record",
        headers=cashier_headers,
        json={"code": student["student_card"], "meal_type": meal_type, "issue_date": service_day.isoformat()},
    )

    assert response.status_code == 409
    assert "error" in response.get_json()

    with app.app_context():
        ticket = get_active_ticket(student["id"], service_day)
        assert MealRecord.query.filter_by(ticket_id=ticket.id, issue_date=service_day, meal_type=meal_type).count() == 1


def test_record_all_returns_409_for_repeated_request(client, app):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))
    student = get_multi_meal_student(client, social_headers)

    create_ticket_for_student(client, social_headers, student["id"], service_day)

    first_response = client.post(
        "/api/meals/record-all",
        headers=cashier_headers,
        json={"code": student["student_card"], "issue_date": service_day.isoformat()},
    )
    repeat_response = client.post(
        "/api/meals/record-all",
        headers=cashier_headers,
        json={"code": student["student_card"], "issue_date": service_day.isoformat()},
    )

    assert first_response.status_code == 201
    assert repeat_response.status_code == 409
    assert "error" in repeat_response.get_json()

    with app.app_context():
        ticket = get_active_ticket(student["id"], service_day)
        assert MealRecord.query.filter_by(ticket_id=ticket.id, issue_date=service_day).count() == len(
            student["category"]["meal_types"]
        )


def test_record_all_maps_integrity_conflict_to_409(client, app, monkeypatch):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))
    student = get_multi_meal_student(client, social_headers)
    meal_types = list(student["category"]["meal_types"])
    duplicate_meal_type = meal_types[0]

    create_ticket_for_student(client, social_headers, student["id"], service_day)

    with app.app_context():
        insert_meal_record(student["id"], duplicate_meal_type, service_day)

    monkeypatch.setattr(meals_route, "build_day_statuses", lambda *_args, **_kwargs: ([], [], meal_types, 0.0))

    response = client.post(
        "/api/meals/record-all",
        headers=cashier_headers,
        json={"code": student["student_card"], "issue_date": service_day.isoformat()},
    )

    assert response.status_code == 409
    payload = response.get_json()
    assert "error" in payload
    assert duplicate_meal_type in payload["data"]["already_issued_meals"]

    with app.app_context():
        ticket = get_active_ticket(student["id"], service_day)
        assert MealRecord.query.filter_by(ticket_id=ticket.id, issue_date=service_day).count() == 1
