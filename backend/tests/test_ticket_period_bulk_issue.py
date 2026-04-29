from __future__ import annotations

from calendar import monthrange
from datetime import date

from app.models import Student, Ticket, User, db
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


def next_month_period(reference: date):
    month = 1 if reference.month == 12 else reference.month + 1
    year = reference.year + 1 if reference.month == 12 else reference.year
    return year, month


def test_bulk_period_issue_splits_request_into_month_segments(client, app):
    headers = login(client, "social1")
    today = date.today()
    next_year, next_month = next_month_period(today)

    with app.app_context():
        student = student_by_card("100002")
        student_id = student.id

    response = client.post(
        "/api/tickets/bulk",
        headers=headers,
        json={
            "student_ids": [student_id],
            "start_date": today.isoformat(),
            "end_date": date(next_year, next_month, 5).isoformat(),
            "only_active": True,
        },
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["created_student_count"] == 1
    assert payload["created_count"] == 2
    assert payload["skipped_count"] == 0

    with app.app_context():
        tickets = (
            Ticket.query.filter_by(student_id=student_id, status="active")
            .order_by(Ticket.year.asc(), Ticket.month.asc(), Ticket.start_date.asc())
            .all()
        )
        assert len(tickets) == 2

        first_ticket, second_ticket = tickets
        assert (first_ticket.year, first_ticket.month) == (today.year, today.month)
        assert first_ticket.start_date == today
        assert first_ticket.end_date == date(today.year, today.month, monthrange(today.year, today.month)[1])

        assert (second_ticket.year, second_ticket.month) == (next_year, next_month)
        assert second_ticket.start_date == date(next_year, next_month, 1)
        assert second_ticket.end_date == date(next_year, next_month, 5)


def test_bulk_preview_returns_month_breakdown_for_cross_month_period(client, app):
    headers = login(client, "social1")
    today = date.today()
    next_year, next_month = next_month_period(today)

    with app.app_context():
        student = student_by_card("100002")
        student_id = student.id

    response = client.post(
        "/api/tickets/bulk/preview",
        headers=headers,
        json={
            "student_ids": [student_id],
            "start_date": today.isoformat(),
            "end_date": date(next_year, next_month, 5).isoformat(),
            "only_active": True,
        },
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["selected_student_count"] == 1
    assert payload["accessible_student_count"] == 1
    assert payload["issueable_student_count"] == 1
    assert payload["total_ticket_count"] == 2
    assert payload["warnings"] == []
    assert payload["month_breakdown"] == [
        {
            "month": today.month,
            "year": today.year,
            "label": f"{today.month:02d}.{today.year}",
            "student_count": 1,
            "ticket_count": 1,
        },
        {
            "month": next_month,
            "year": next_year,
            "label": f"{next_month:02d}.{next_year}",
            "student_count": 1,
            "ticket_count": 1,
        },
    ]


def test_bulk_period_issue_skips_student_when_any_segment_already_has_active_ticket(client, app):
    headers = login(client, "social1")
    today = date.today()
    next_year, next_month = next_month_period(today)

    with app.app_context():
        student = student_by_card("100002")
        creator = user_by_username("social1")
        build_ticket(
            student,
            creator.id,
            date(next_year, next_month, 1),
            date(next_year, next_month, monthrange(next_year, next_month)[1]),
        )
        db.session.commit()
        student_id = student.id

    response = client.post(
        "/api/tickets/bulk",
        headers=headers,
        json={
            "student_ids": [student_id],
            "start_date": today.isoformat(),
            "end_date": date(next_year, next_month, 5).isoformat(),
            "only_active": True,
        },
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["created_count"] == 0
    assert payload["created_student_count"] == 0
    assert payload["skipped_count"] == 1
    assert "skipped_students" in payload
    assert "error" not in response.get_json()

    with app.app_context():
        tickets = Ticket.query.filter_by(student_id=student_id, status="active").all()
        assert len(tickets) == 1
        assert tickets[0].month == next_month
        assert tickets[0].year == next_year


def test_bulk_preview_reports_conflict_warning_when_segment_is_blocked(client, app):
    headers = login(client, "social1")
    today = date.today()
    next_year, next_month = next_month_period(today)

    with app.app_context():
        student = student_by_card("100002")
        creator = user_by_username("social1")
        build_ticket(
            student,
            creator.id,
            date(next_year, next_month, 1),
            date(next_year, next_month, monthrange(next_year, next_month)[1]),
        )
        db.session.commit()
        student_id = student.id

    response = client.post(
        "/api/tickets/bulk/preview",
        headers=headers,
        json={
            "student_ids": [student_id],
            "start_date": today.isoformat(),
            "end_date": date(next_year, next_month, 5).isoformat(),
            "only_active": True,
        },
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["issueable_student_count"] == 0
    assert payload["total_ticket_count"] == 0
    assert payload["warnings"] == [
        {
            "code": "conflict",
            "count": 1,
            "message": "У 1 студента уже есть талоны в выбранном периоде",
        }
    ]
    assert payload["skipped_students"][0]["student_id"] == student_id


def test_ticket_print_sheet_document_supports_large_preset(client, app):
    headers = login(client, "social1")
    today = date.today()

    with app.app_context():
        student = student_by_card("100002")
        creator = user_by_username("social1")
        build_ticket(
            student,
            creator.id,
            date(today.year, today.month, 1),
            date(today.year, today.month, monthrange(today.year, today.month)[1]),
        )
        db.session.commit()

    response = client.post(
        "/api/tickets/print-sheet/document",
        headers=headers,
        json={"month": today.month, "year": today.year, "print_size": "large"},
    )

    assert response.status_code == 200
    html = response.get_json()["data"]["html"]
    assert "ticket-print-grid--large" in html
