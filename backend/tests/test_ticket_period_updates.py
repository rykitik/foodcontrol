from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta

from sqlalchemy import and_

from app.models import MealRecord, Student, Ticket, User, db
from app.services.ticket_lifecycle import build_ticket


def login(client, username: str, password: str = "password123") -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    token = response.get_json()["data"]["token"]
    return {"Authorization": f"Bearer {token}"}


def student_by_card(card: str) -> Student:
    student = Student.query.filter_by(student_card=card).first()
    assert student is not None
    return student


def user_by_username(username: str) -> User:
    user = User.query.filter_by(username=username).first()
    assert user is not None
    return user


def student_without_active_ticket(month: int, year: int) -> Student:
    student = (
        Student.query.filter(
            ~Student.tickets.any(and_(Ticket.month == month, Ticket.year == year, Ticket.status == "active"))
        )
        .order_by(Student.full_name.asc())
        .first()
    )
    assert student is not None
    return student


def add_meal_record(ticket: Ticket, cashier: User, issue_date: date) -> MealRecord:
    record = MealRecord(
        ticket_id=ticket.id,
        student_id=ticket.student_id,
        meal_type="lunch",
        issue_date=issue_date,
        issued_by=cashier.id,
        building_id=ticket.student.effective_meal_building_id,
        price=165,
    )
    db.session.add(record)
    db.session.flush()
    return record


def test_create_ticket_for_current_month_starts_from_today(client, app):
    headers = login(client, "social1")
    today = date.today()

    with app.app_context():
        student_id = student_without_active_ticket(today.month, today.year).id

    response = client.post(
        "/api/tickets",
        headers=headers,
        json={"student_id": student_id, "month": today.month, "year": today.year},
    )

    assert response.status_code == 201
    payload = response.get_json()["data"]
    assert payload["start_date"] == today.isoformat()
    assert payload["end_date"] == date(today.year, today.month, monthrange(today.year, today.month)[1]).isoformat()


def test_bulk_preview_rejects_creation_period_starting_before_today(client, app):
    headers = login(client, "social1")
    today = date.today()

    with app.app_context():
        student_id = student_by_card("100002").id

    response = client.post(
        "/api/tickets/bulk/preview",
        headers=headers,
        json={
            "student_ids": [student_id],
            "start_date": (today - timedelta(days=1)).isoformat(),
            "end_date": (today + timedelta(days=5)).isoformat(),
            "only_active": True,
        },
    )

    assert response.status_code == 400
    assert "сегодня" in response.get_json()["error"].lower()


def test_update_ticket_end_date_allows_shortening_ticket_with_meals(client, app):
    headers = login(client, "social1")
    today = date.today()
    month_start = date(today.year, today.month, 1)
    month_end = date(today.year, today.month, monthrange(today.year, today.month)[1])

    with app.app_context():
        student = student_by_card("100002")
        creator = user_by_username("social1")
        cashier = user_by_username("cashier1")
        ticket = build_ticket(student, creator.id, month_start, month_end)
        db.session.flush()
        add_meal_record(ticket, cashier, today)
        db.session.commit()
        ticket_id = ticket.id

    response = client.patch(
        f"/api/tickets/{ticket_id}",
        headers=headers,
        json={"end_date": today.isoformat()},
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["end_date"] == today.isoformat()
    assert payload["status"] == "active"


def test_update_ticket_end_date_rejects_cutting_off_existing_meals(client, app):
    headers = login(client, "social1")
    today = date.today()
    requested_end_date = today - timedelta(days=1)
    start_date = requested_end_date - timedelta(days=1)
    end_date = today + timedelta(days=5)

    with app.app_context():
        student = student_by_card("100002")
        creator = user_by_username("social1")
        cashier = user_by_username("cashier1")
        ticket = build_ticket(student, creator.id, start_date, end_date)
        db.session.flush()
        add_meal_record(ticket, cashier, today)
        db.session.commit()
        ticket_id = ticket.id

    response = client.patch(
        f"/api/tickets/{ticket_id}",
        headers=headers,
        json={"end_date": requested_end_date.isoformat()},
    )

    assert response.status_code == 409
    assert "последней выдачи" in response.get_json()["error"].lower()


def test_update_ticket_still_blocks_cancellation_when_meals_exist(client, app):
    headers = login(client, "social1")
    today = date.today()
    month_start = date(today.year, today.month, 1)
    month_end = date(today.year, today.month, monthrange(today.year, today.month)[1])

    with app.app_context():
        student = student_by_card("100002")
        creator = user_by_username("social1")
        cashier = user_by_username("cashier1")
        ticket = build_ticket(student, creator.id, month_start, month_end)
        db.session.flush()
        add_meal_record(ticket, cashier, today)
        db.session.commit()
        ticket_id = ticket.id

    response = client.patch(
        f"/api/tickets/{ticket_id}",
        headers=headers,
        json={"status": "cancelled"},
    )

    assert response.status_code == 409
    assert "нельзя отменять" in response.get_json()["error"].lower()
