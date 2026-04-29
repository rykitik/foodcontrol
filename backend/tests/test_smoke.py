from __future__ import annotations

from datetime import date, timedelta
from io import BytesIO

from openpyxl import load_workbook

from app.models import Student, db
from app.services.student_cards import generate_next_student_card


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


def first_weekend_day(reference: date | None = None) -> date:
    current = reference or date.today().replace(day=1)
    while current.weekday() != 6:
        current += timedelta(days=1)
    return current


def test_healthcheck(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.get_json()["status"] == "ok"


def test_login_and_profile_flow(client):
    headers = login(client, "social1")

    response = client.get("/api/auth/profile", headers=headers)

    assert response.status_code == 200
    assert response.get_json()["data"]["username"] == "social1"


def test_student_history_and_ticket_flow(client):
    social_headers = login(client, "social1")
    search_response = client.get("/api/students/search", headers=social_headers)
    student_id = search_response.get_json()["data"][0]["id"]

    ticket_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student_id, "month": date.today().month, "year": date.today().year},
    )

    assert ticket_response.status_code == 201

    history_response = client.get(f"/api/students/{student_id}/history", headers=social_headers)
    tickets_response = client.get(f"/api/students/{student_id}/tickets", headers=social_headers)

    assert history_response.status_code == 200
    assert tickets_response.status_code == 200
    assert len(tickets_response.get_json()["data"]) >= 1


def test_cashier_can_record_meal_and_audit_log_is_created(client):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    admin_headers = login(client, "headsocial")
    service_day = first_service_day(date.today().replace(day=1))

    students_response = client.get("/api/students/search", headers=social_headers)
    student = students_response.get_json()["data"][0]
    meal_type = student["category"]["meal_types"][-1]

    ticket_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": service_day.month, "year": service_day.year},
    )
    assert ticket_response.status_code in {201, 409}

    meal_response = client.post(
        "/api/meals/record",
        headers=cashier_headers,
        json={"code": student["student_card"], "meal_type": meal_type, "issue_date": service_day.isoformat()},
    )

    assert meal_response.status_code == 201

    logs_response = client.get("/api/logs", headers=admin_headers)
    assert logs_response.status_code == 200
    assert any(entry["action"] == "record_meal" for entry in logs_response.get_json()["data"])


def test_cashier_can_record_all_available_meals_for_day(client):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))

    students = client.get("/api/students/search", headers=social_headers).get_json()["data"]
    student = next((item for item in students if len(item["category"]["meal_types"]) > 1), students[0])

    ticket_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": service_day.month, "year": service_day.year},
    )
    assert ticket_response.status_code in {201, 409}

    meal_response = client.post(
        "/api/meals/record-all",
        headers=cashier_headers,
        json={"code": student["student_card"], "issue_date": service_day.isoformat()},
    )

    assert meal_response.status_code == 201
    payload = meal_response.get_json()["data"]
    assert len(payload["records"]) >= 1
    assert set(payload["issued_meals"]) == set(student["category"]["meal_types"])

    duplicate_response = client.post(
        "/api/meals/record-all",
        headers=cashier_headers,
        json={"code": student["student_card"], "issue_date": service_day.isoformat()},
    )
    assert duplicate_response.status_code == 409


def test_cashier_can_confirm_selected_meals_with_request_id(client):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))

    students = client.get("/api/students/search", headers=social_headers).get_json()["data"]
    student = next((item for item in students if len(item["category"]["meal_types"]) > 1), students[0])

    ticket_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": service_day.month, "year": service_day.year},
    )
    assert ticket_response.status_code in {201, 409}

    request_id = "test-confirm-request-1"
    confirm_response = client.post(
        "/api/meals/confirm-selection",
        headers=cashier_headers,
        json={
            "code": student["student_card"],
            "issue_date": service_day.isoformat(),
            "request_id": request_id,
            "selected_meals": student["category"]["meal_types"],
        },
    )

    assert confirm_response.status_code == 201
    payload = confirm_response.get_json()["data"]
    assert set(payload["issued_meals"]) == set(student["category"]["meal_types"])
    assert payload["request_id"] == request_id

    repeat_response = client.post(
        "/api/meals/confirm-selection",
        headers=cashier_headers,
        json={
            "code": student["student_card"],
            "issue_date": service_day.isoformat(),
            "request_id": request_id,
            "selected_meals": student["category"]["meal_types"],
        },
    )
    assert repeat_response.status_code == 200
    repeat_payload = repeat_response.get_json()["data"]
    assert repeat_payload["request_id"] == request_id
    assert set(repeat_payload["issued_meals"]) == set(student["category"]["meal_types"])


def test_ticket_can_be_cancelled(client):
    social_headers = login(client, "social1")
    student_id = client.get("/api/students/search", headers=social_headers).get_json()["data"][0]["id"]

    create_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student_id, "month": date.today().month, "year": date.today().year},
    )
    assert create_response.status_code in {201, 409}

    if create_response.status_code == 201:
        ticket_id = create_response.get_json()["data"]["id"]
    else:
        ticket_id = client.get(f"/api/students/{student_id}/tickets", headers=social_headers).get_json()["data"][0]["id"]

    update_response = client.patch(
        f"/api/tickets/{ticket_id}",
        headers=social_headers,
        json={"status": "cancelled"},
    )

    assert update_response.status_code == 200
    assert update_response.get_json()["data"]["status"] == "cancelled"


def test_ticket_with_meals_cannot_be_cancelled(client):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))
    student = client.get("/api/students/search", headers=social_headers).get_json()["data"][0]
    meal_type = student["category"]["meal_types"][-1]

    create_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": service_day.month, "year": service_day.year},
    )
    ticket_id = (
        create_response.get_json()["data"]["id"]
        if create_response.status_code == 201
        else client.get(f"/api/students/{student['id']}/tickets", headers=social_headers).get_json()["data"][0]["id"]
    )

    meal_response = client.post(
        "/api/meals/record",
        headers=cashier_headers,
        json={"code": student["student_card"], "meal_type": meal_type, "issue_date": service_day.isoformat()},
    )
    assert meal_response.status_code == 201

    update_response = client.patch(
        f"/api/tickets/{ticket_id}",
        headers=social_headers,
        json={"status": "cancelled"},
    )

    assert update_response.status_code == 409


def test_bulk_ticket_creation(client):
    social_headers = login(client, "social1")

    response = client.post(
        "/api/tickets/bulk",
        headers=social_headers,
        json={
            "building_id": 1,
            "month": date.today().month,
            "year": date.today().year,
            "only_active": True,
        },
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["created_count"] >= 0
    assert payload["skipped_count"] >= 0


def test_clone_tickets_from_previous_month(client):
    social_headers = login(client, "social1")
    today = date.today()
    source_month = today.month
    source_year = today.year
    target_month = 1 if source_month == 12 else source_month + 1
    target_year = source_year + 1 if source_month == 12 else source_year

    create_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={
            "student_id": client.get("/api/students/search", headers=social_headers).get_json()["data"][0]["id"],
            "month": source_month,
            "year": source_year,
        },
    )
    assert create_response.status_code in {201, 409}

    clone_response = client.post(
        "/api/tickets/bulk-from-previous",
        headers=social_headers,
        json={
            "source_month": source_month,
            "source_year": source_year,
            "target_month": target_month,
            "target_year": target_year,
            "building_id": 1,
        },
    )

    assert clone_response.status_code == 200
    payload = clone_response.get_json()["data"]
    assert payload["created_count"] >= 0


def test_ticket_rejects_invalid_month(client):
    social_headers = login(client, "social1")
    student_id = client.get("/api/students/search", headers=social_headers).get_json()["data"][0]["id"]

    response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student_id, "month": 13, "year": 2026},
    )

    assert response.status_code == 400


def test_ticket_rejects_past_month(client):
    social_headers = login(client, "social1")
    student_id = client.get("/api/students/search", headers=social_headers).get_json()["data"][0]["id"]

    today = date.today()
    past_month = 12 if today.month == 1 else today.month - 1
    past_year = today.year - 1 if today.month == 1 else today.year

    response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student_id, "month": past_month, "year": past_year},
    )

    assert response.status_code == 400
    assert "прошедшие месяцы" in response.get_json()["error"]


def test_ticket_qr_value_can_be_used_for_cashier_lookup(client):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))
    student = client.get("/api/students/search", headers=social_headers).get_json()["data"][0]

    ticket_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": service_day.month, "year": service_day.year},
    )
    assert ticket_response.status_code in {201, 409}

    if ticket_response.status_code == 201:
        ticket_payload = ticket_response.get_json()["data"]
    else:
        ticket_payload = client.get(f"/api/students/{student['id']}/tickets", headers=social_headers).get_json()["data"][0]

    lookup_response = client.get(
        f"/api/meals/resolve?query={ticket_payload['qr_code']}",
        headers=cashier_headers,
    )
    assert lookup_response.status_code == 200
    assert lookup_response.get_json()["data"]["student"]["id"] == student["id"]


def test_cashier_lookup_hides_available_meals_for_inactive_student(client, app):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))
    student = client.get("/api/students/search", headers=social_headers).get_json()["data"][0]

    ticket_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": service_day.month, "year": service_day.year},
    )
    assert ticket_response.status_code in {201, 409}

    with app.app_context():
        student_record = db.session.get(Student, student["id"])
        assert student_record is not None
        student_record.is_active = False
        db.session.commit()

    lookup_response = client.get(
        f"/api/meals/resolve?query={student['student_card']}",
        headers=cashier_headers,
    )

    assert lookup_response.status_code == 200
    payload = lookup_response.get_json()["data"]
    assert payload["student"]["id"] == student["id"]
    assert payload["student"]["is_active"] is False
    assert payload["allowed_meals"] == []
    assert payload["remaining_meals"] == []


def test_cashier_daily_summary_returns_recent_days(client):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_service_day(date.today().replace(day=1))

    student = client.get("/api/students/search", headers=social_headers).get_json()["data"][0]
    ticket_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": service_day.month, "year": service_day.year},
    )
    assert ticket_response.status_code in {201, 409}

    meal_type = student["category"]["meal_types"][-1]
    meal_response = client.post(
        "/api/meals/record",
        headers=cashier_headers,
        json={"code": student["student_card"], "meal_type": meal_type, "issue_date": service_day.isoformat()},
    )
    assert meal_response.status_code == 201

    summary_response = client.get("/api/meals/daily-summary?days=3", headers=cashier_headers)
    assert summary_response.status_code == 200
    payload = summary_response.get_json()["data"]
    assert {"period_start", "period_end", "overview", "scope", "daily_rows", "buildings_table"} <= payload.keys()
    assert len(payload["daily_rows"]) == 3
    assert {"issue_date", "count", "breakfast_count", "lunch_count", "amount"} <= payload["daily_rows"][0].keys()


def test_weekend_meal_issue_is_blocked(client):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    weekend_day = first_weekend_day(date.today().replace(day=1))

    student = client.get("/api/students/search", headers=social_headers).get_json()["data"][0]
    meal_type = student["category"]["meal_types"][-1]

    ticket_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": weekend_day.month, "year": weekend_day.year},
    )
    assert ticket_response.status_code in {201, 409}

    meal_response = client.post(
        "/api/meals/record",
        headers=cashier_headers,
        json={"code": student["student_card"], "meal_type": meal_type, "issue_date": weekend_day.isoformat()},
    )

    assert meal_response.status_code == 409


def test_holiday_calendar_blocks_meal_issue(client):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    admin_headers = login(client, "headsocial")
    service_day = first_service_day(date.today().replace(day=1))

    create_holiday_response = client.post(
        "/api/holidays",
        headers=admin_headers,
        json={"holiday_date": service_day.isoformat(), "title": "Праздничный день"},
    )
    assert create_holiday_response.status_code == 201

    list_response = client.get(
        f"/api/holidays?year={service_day.year}&month={service_day.month}",
        headers=admin_headers,
    )
    assert list_response.status_code == 200
    assert any(item["holiday_date"] == service_day.isoformat() for item in list_response.get_json()["data"])

    student = client.get("/api/students/search", headers=social_headers).get_json()["data"][0]
    meal_type = student["category"]["meal_types"][-1]

    ticket_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": service_day.month, "year": service_day.year},
    )
    assert ticket_response.status_code in {201, 409}

    meal_response = client.post(
        "/api/meals/record",
        headers=cashier_headers,
        json={"code": student["student_card"], "meal_type": meal_type, "issue_date": service_day.isoformat()},
    )

    assert meal_response.status_code == 409


def test_official_holidays_are_auto_listed_in_calendar(client):
    admin_headers = login(client, "headsocial")
    current_year = date.today().year

    response = client.get(
        f"/api/holidays?year={current_year}&month=1",
        headers=admin_headers,
    )
    assert response.status_code == 200
    payload = response.get_json()["data"]
    holiday_dates = {item["holiday_date"] for item in payload}

    assert f"{current_year}-01-01" in holiday_dates
    assert f"{current_year}-01-07" in holiday_dates


def test_student_import_preview_and_commit(client, app):
    admin_headers = login(client, "headsocial")
    csv_payload = "full_name,group_name,building_id,category_name\nТестов Тест Тестович,ИСП-999,1,ОВЗ\n".encode("utf-8")

    with app.app_context():
        expected_student_card = generate_next_student_card(db.session)

    preview_response = client.post(
        "/api/imports/students",
        headers=admin_headers,
        data={"dry_run": "true", "file": (BytesIO(csv_payload), "students.csv")},
        content_type="multipart/form-data",
    )
    assert preview_response.status_code == 200
    preview_payload = preview_response.get_json()["data"]
    assert preview_payload["dry_run"] is True
    assert preview_payload["created"] == 1
    assert "student_card" not in preview_payload["columns"]

    import_response = client.post(
        "/api/imports/students",
        headers=admin_headers,
        data={"dry_run": "false", "file": (BytesIO(csv_payload), "students.csv")},
        content_type="multipart/form-data",
    )
    assert import_response.status_code == 200
    payload = import_response.get_json()["data"]
    assert payload["dry_run"] is False
    assert payload["created"] == 1

    search_response = client.get("/api/students/search?q=Тестов Тест Тестович", headers=admin_headers)
    assert search_response.status_code == 200
    imported_student = next(student for student in search_response.get_json()["data"] if student["group_name"] == "ИСП-999")
    assert imported_student["student_card"] == expected_student_card


def test_student_import_reuses_existing_student_without_manual_card(client, app):
    admin_headers = login(client, "headsocial")
    csv_payload = "full_name,group_name,building_id,category_name\nПовторный Импорт,ИСП-777,1,ОВЗ\n".encode("utf-8")

    first_response = client.post(
        "/api/imports/students",
        headers=admin_headers,
        data={"dry_run": "false", "file": (BytesIO(csv_payload), "students.csv")},
        content_type="multipart/form-data",
    )
    assert first_response.status_code == 200
    assert first_response.get_json()["data"]["created"] == 1

    second_response = client.post(
        "/api/imports/students",
        headers=admin_headers,
        data={"dry_run": "false", "file": (BytesIO(csv_payload), "students.csv")},
        content_type="multipart/form-data",
    )
    assert second_response.status_code == 200
    second_payload = second_response.get_json()["data"]
    assert second_payload["created"] == 0
    assert second_payload["updated"] == 1

    with app.app_context():
        assert Student.query.filter_by(full_name="Повторный Импорт", group_name="ИСП-777", building_id=1).count() == 1


def test_student_import_template_downloads_as_xlsx_with_split_columns(client):
    admin_headers = login(client, "headsocial")

    response = client.get("/api/imports/templates/students.xlsx", headers=admin_headers)

    assert response.status_code == 200
    workbook = load_workbook(filename=BytesIO(response.data))
    sheet = workbook.active
    headers = [cell.value for cell in sheet[1]]

    assert headers == ["ФИО", "Группа", "Корпус", "Категория"]
    assert "is_active" not in headers
