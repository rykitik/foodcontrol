from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from app.models import MealRecord, Student, Ticket, User, db


def login(client, username: str, password: str = "password123") -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    token = response.get_json()["data"]["token"]
    return {"Authorization": f"Bearer {token}"}


def create_user(app, *, username: str, role: str, building_id: int | None, password: str = "password123") -> None:
    with app.app_context():
        user = User(
            username=username,
            full_name=f"{username} test",
            role=role,
            building_id=building_id,
            is_active=True,
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()


def first_service_day(reference: date | None = None) -> date:
    current = reference or date.today().replace(day=1)
    while current.weekday() == 6:
        current += timedelta(days=1)
    return current


def create_ticket_for_student(
    student: dict,
    creator_id: str,
    *,
    service_day: date,
    suffix: str,
    status: str,
) -> str:
    ticket = Ticket(
        student_id=student["id"],
        category_id=student["category_id"],
        month=service_day.month,
        year=service_day.year,
        start_date=date(service_day.year, service_day.month, 1),
        end_date=date(service_day.year, service_day.month, monthrange(service_day.year, service_day.month)[1]),
        status=status,
        qr_code=f"journal-{student['student_card']}-{suffix}",
        created_by=creator_id,
        created_at=datetime(service_day.year, service_day.month, service_day.day, 8, 0, 0),
    )
    db.session.add(ticket)
    db.session.flush()
    return ticket.id


def create_meal_record(
    *,
    ticket_id: str,
    student_id: str,
    meal_type: str,
    issue_date: date,
    issue_time: time,
    issued_by: str,
    building_id: int,
    price: float,
) -> None:
    db.session.add(
        MealRecord(
            ticket_id=ticket_id,
            student_id=student_id,
            meal_type=meal_type,
            issue_date=issue_date,
            issue_time=issue_time,
            issued_by=issued_by,
            building_id=building_id,
            price=Decimal(str(price)),
        )
    )


def test_cashier_journal_flags_duplicate_same_meal_and_cross_building_issue(client, app):
    create_user(app, username="cashier2", role="cashier", building_id=2)

    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))

    student = client.get("/api/students/search?q=100001", headers=social_headers).get_json()["data"][0]

    with app.app_context():
        social_user = User.query.filter_by(username="social1").first()
        cashier1 = User.query.filter_by(username="cashier1").first()
        cashier2 = User.query.filter_by(username="cashier2").first()
        assert social_user is not None
        assert cashier1 is not None
        assert cashier2 is not None

        student_row = Student.query.filter_by(id=student["id"]).first()
        assert student_row is not None
        student_row.meal_building_id = None
        student_row.allow_all_meal_buildings = True

        ticket1_id = create_ticket_for_student(
            student,
            social_user.id,
            service_day=service_day,
            suffix="a",
            status="used",
        )
        ticket2_id = create_ticket_for_student(
            student,
            social_user.id,
            service_day=service_day,
            suffix="b",
            status="active",
        )

        meal_type = student["category"]["meal_types"][-1]
        create_meal_record(
            ticket_id=ticket1_id,
            student_id=student["id"],
            meal_type=meal_type,
            issue_date=service_day,
            issue_time=time(9, 15),
            issued_by=cashier1.id,
            building_id=1,
            price=160,
        )
        create_meal_record(
            ticket_id=ticket2_id,
            student_id=student["id"],
            meal_type=meal_type,
            issue_date=service_day,
            issue_time=time(11, 45),
            issued_by=cashier2.id,
            building_id=2,
            price=160,
        )
        db.session.commit()

    response = client.get(
        f"/api/meals/cashier-journal?date={service_day.isoformat()}",
        headers=cashier_headers,
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["date"] == service_day.isoformat()
    assert payload["scope"]["building_id"] == 1
    assert payload["summary"]["records_count"] == 1
    assert payload["summary"]["attention_records_count"] == 1
    assert payload["summary"]["duplicate_same_meal_count"] == 1
    assert payload["summary"]["multiple_buildings_count"] == 1
    assert payload["summary"]["outside_assigned_building_count"] == 1

    record = payload["records"][0]
    codes = {item["code"] for item in record["attention_flags"]}
    assert codes == {"duplicate_same_meal", "multiple_buildings"}

    attention_item = payload["attention_items"][0]
    assert set(attention_item["codes"]) == {
        "duplicate_same_meal",
        "multiple_buildings",
        "outside_assigned_building",
    }
    assert {item["building_id"] for item in attention_item["buildings"]} == {1, 2}


def test_cashier_journal_respects_effective_meal_building_for_lookup_and_snapshot(client, app):
    create_user(app, username="cashier2", role="cashier", building_id=2)

    social_headers = login(client, "social1")
    cashier2_headers = login(client, "cashier2")

    student = client.get("/api/students/search?q=100001", headers=social_headers).get_json()["data"][0]

    update_response = client.patch(
        f"/api/students/{student['id']}",
        headers=social_headers,
        json={"allow_all_meal_buildings": True},
    )
    assert update_response.status_code == 200

    lookup_response = client.get(f"/api/meals/resolve?query={student['student_card']}", headers=cashier2_headers)
    snapshot_response = client.get("/api/meals/offline-snapshot", headers=cashier2_headers)

    assert lookup_response.status_code == 403
    assert snapshot_response.status_code == 200
    snapshot_students = snapshot_response.get_json()["data"]["datasets"]["students"]
    assert all(item["id"] != student["id"] for item in snapshot_students)
