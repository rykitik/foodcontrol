from __future__ import annotations

from calendar import monthrange
from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError

import app.routes.tickets.lifecycle as tickets_lifecycle_module
from app.models import Student, Ticket, User, db
from app.services.ticket_lifecycle import build_ticket


def login(client, username: str, password: str = "password123") -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    token = response.get_json()["data"]["token"]
    return {"Authorization": f"Bearer {token}"}


def month_bounds(year: int, month: int):
    start_date = date(year, month, 1)
    end_date = date(year, month, monthrange(year, month)[1])
    return start_date, end_date


def current_period():
    today = date.today()
    start_date, end_date = month_bounds(today.year, today.month)
    return today.month, today.year, start_date, end_date


def next_period():
    today = date.today()
    month = 1 if today.month == 12 else today.month + 1
    year = today.year + 1 if today.month == 12 else today.year
    start_date, end_date = month_bounds(year, month)
    return month, year, start_date, end_date


def student_by_card(card: str) -> Student:
    student = Student.query.filter_by(student_card=card).first()
    assert student is not None
    return student


def user_by_username(username: str) -> User:
    user = User.query.filter_by(username=username).first()
    assert user is not None
    return user


def create_direct_ticket(student: Student, creator: User, *, month: int, year: int, status: str = "active") -> Ticket:
    start_date, end_date = month_bounds(year, month)
    ticket = Ticket(
        student_id=student.id,
        category_id=student.category_id,
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        status=status,
        qr_code=f"manual-{student.id}-{status}-{year}-{month}",
        created_by=creator.id,
    )
    db.session.add(ticket)
    db.session.commit()
    return ticket


def test_db_invariant_blocks_second_active_ticket_for_same_student_period(app):
    with app.app_context():
        student = student_by_card("100001")
        creator = user_by_username("social1")
        month, year, start_date, end_date = current_period()

        build_ticket(student, creator.id, start_date, end_date)
        db.session.commit()

        with pytest.raises(IntegrityError):
            build_ticket(student, creator.id, start_date, end_date)

        db.session.rollback()
        assert Ticket.query.filter_by(student_id=student.id, month=month, year=year, status="active").count() == 1


def test_create_ticket_returns_409_when_db_unique_index_catches_conflict(client, app, monkeypatch):
    headers = login(client, "social1")
    month, year, start_date, end_date = current_period()

    with app.app_context():
        student = student_by_card("100001")
        creator = user_by_username("social1")
        build_ticket(student, creator.id, start_date, end_date)
        db.session.commit()
        student_id = student.id

    monkeypatch.setattr(tickets_lifecycle_module, "find_active_ticket", lambda *_args, **_kwargs: None)

    response = client.post(
        "/api/tickets",
        headers=headers,
        json={"student_id": student_id, "month": month, "year": year},
    )

    assert response.status_code == 409
    assert "error" in response.get_json()

    with app.app_context():
        assert Ticket.query.filter_by(student_id=student_id, month=month, year=year, status="active").count() == 1


def test_update_ticket_returns_409_when_db_unique_index_catches_reactivation_conflict(client, app, monkeypatch):
    headers = login(client, "social1")
    month, year, start_date, end_date = current_period()

    with app.app_context():
        student = student_by_card("100001")
        creator = user_by_username("social1")
        build_ticket(student, creator.id, start_date, end_date)
        db.session.commit()
        cancelled_ticket = create_direct_ticket(student, creator, month=month, year=year, status="cancelled")
        cancelled_ticket_id = cancelled_ticket.id

    monkeypatch.setattr(tickets_lifecycle_module, "find_active_ticket", lambda *_args, **_kwargs: None)

    response = client.patch(
        f"/api/tickets/{cancelled_ticket_id}",
        headers=headers,
        json={"status": "active"},
    )

    assert response.status_code == 409
    assert "error" in response.get_json()

    with app.app_context():
        reloaded = Ticket.query.filter_by(id=cancelled_ticket_id).first()
        assert reloaded is not None
        assert reloaded.status == "cancelled"
        assert Ticket.query.filter_by(student_id=reloaded.student_id, month=month, year=year, status="active").count() == 1


def test_reissue_ticket_still_succeeds_with_unique_active_invariant(client, app):
    headers = login(client, "social1")
    month, year, _start_date, _end_date = current_period()

    with app.app_context():
        student = student_by_card("100002")
        student_id = student.id

    create_response = client.post(
        "/api/tickets",
        headers=headers,
        json={"student_id": student_id, "month": month, "year": year},
    )
    assert create_response.status_code == 201
    old_ticket_id = create_response.get_json()["data"]["id"]

    response = client.post(f"/api/tickets/{old_ticket_id}/reissue", headers=headers)

    assert response.status_code == 201
    replacement_id = response.get_json()["data"]["id"]
    assert replacement_id != old_ticket_id

    with app.app_context():
        old_ticket = Ticket.query.filter_by(id=old_ticket_id).first()
        replacement = Ticket.query.filter_by(id=replacement_id).first()
        assert old_ticket is not None
        assert replacement is not None
        assert old_ticket.status == "cancelled"
        assert replacement.status == "active"
        assert Ticket.query.filter_by(student_id=student_id, month=month, year=year, status="active").count() == 1


def test_bulk_ticket_creation_handles_db_unique_conflict_without_500(client, app, monkeypatch):
    headers = login(client, "social1")
    month, year, start_date, end_date = current_period()

    with app.app_context():
        student = student_by_card("100001")
        creator = user_by_username("social1")
        build_ticket(student, creator.id, start_date, end_date)
        db.session.commit()
        conflicting_student_id = student.id

    monkeypatch.setattr(tickets_lifecycle_module, "find_active_ticket", lambda *_args, **_kwargs: None)

    response = client.post(
        "/api/tickets/bulk",
        headers=headers,
        json={"building_id": 1, "month": month, "year": year, "only_active": True},
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["skipped_count"] >= 1
    assert payload["created_count"] >= 1
    assert any(item["student_id"] == conflicting_student_id for item in payload["skipped_students"])

    with app.app_context():
        assert Ticket.query.filter_by(student_id=conflicting_student_id, month=month, year=year, status="active").count() == 1


def test_clone_tickets_from_previous_handles_db_unique_conflict_without_500(client, app, monkeypatch):
    headers = login(client, "social1")
    source_month, source_year, source_start, source_end = current_period()
    target_month, target_year, target_start, target_end = next_period()

    with app.app_context():
        creator = user_by_username("social1")
        student_one = student_by_card("100001")
        student_two = student_by_card("100002")

        build_ticket(student_one, creator.id, source_start, source_end)
        build_ticket(student_two, creator.id, source_start, source_end)
        db.session.commit()

        build_ticket(student_one, creator.id, target_start, target_end)
        db.session.commit()
        conflicting_student_id = student_one.id

    monkeypatch.setattr(tickets_lifecycle_module, "find_active_ticket", lambda *_args, **_kwargs: None)

    response = client.post(
        "/api/tickets/bulk-from-previous",
        headers=headers,
        json={
            "source_month": source_month,
            "source_year": source_year,
            "target_month": target_month,
            "target_year": target_year,
            "building_id": 1,
        },
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["skipped_count"] >= 1
    assert payload["created_count"] >= 1
    assert any(item["student_id"] == conflicting_student_id for item in payload["skipped_students"])

    with app.app_context():
        assert Ticket.query.filter_by(student_id=conflicting_student_id, month=target_month, year=target_year, status="active").count() == 1
