from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.models import User, db


def login(client, username: str, password: str = "password123") -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    payload = response.get_json()
    token = payload["data"]["token"]
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


def assign_student_meal_building(client, headers: dict[str, str], student_id: str, meal_building_id: int | None):
    return client.patch(
        f"/api/students/{student_id}",
        headers=headers,
        json={"meal_building_id": meal_building_id},
    )


def first_saturday(reference: date | None = None) -> date:
    current = reference or date.today().replace(day=1)
    while current.weekday() != 5:
        current += timedelta(days=1)
    return current


def test_category_breakfast_flag_can_be_updated(client):
    headers = login(client, "headsocial")

    categories = client.get("/api/categories", headers=headers)
    assert categories.status_code == 200
    category = categories.get_json()["data"][0]

    response = client.patch(
        f"/api/categories/{category['id']}",
        headers=headers,
        json={
            "breakfast": not category["breakfast"],
            "lunch": category["lunch"],
            "breakfast_price": 123.45,
            "lunch_price": 234.56,
        },
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["breakfast"] is (not category["breakfast"])
    assert payload["breakfast_price"] == 123.45
    assert payload["lunch_price"] == 234.56


def test_head_social_can_rename_and_create_category(client):
    headers = login(client, "headsocial")

    categories = client.get("/api/categories", headers=headers)
    assert categories.status_code == 200
    original = categories.get_json()["data"][0]

    rename_response = client.patch(
        f"/api/categories/{original['id']}",
        headers=headers,
        json={"name": "ОВЗ обновленная"},
    )
    assert rename_response.status_code == 200
    renamed = rename_response.get_json()["data"]
    assert renamed["name"] == "ОВЗ обновленная"
    assert renamed["code"] == original["code"]

    create_response = client.post(
        "/api/categories",
        headers=headers,
        json={
            "name": "Новая категория",
            "breakfast": True,
            "lunch": True,
            "breakfast_price": 95,
            "lunch_price": 150,
            "description": "Тестовая категория",
        },
    )
    assert create_response.status_code == 201
    created = create_response.get_json()["data"]
    assert created["name"] == "Новая категория"
    assert created["code"] == "novaya_kategoriya"
    assert created["meal_types"] == ["breakfast", "lunch"]


def test_svo_category_is_seeded(client):
    headers = login(client, "headsocial")

    response = client.get("/api/categories", headers=headers)
    assert response.status_code == 200
    categories = response.get_json()["data"]
    svo = next((category for category in categories if category["code"] == "svo"), None)

    assert svo is not None
    assert svo["name"] == "СВО"
    assert svo["description"] == "Дети участников СВО"


def test_updated_category_price_is_used_for_new_meal_records(client):
    head_headers = login(client, "headsocial")
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_saturday(date.today().replace(day=1))

    students = client.get("/api/students/search?q=100002", headers=social_headers).get_json()["data"]
    student = students[0]

    category_response = client.patch(
        f"/api/categories/{student['category_id']}",
        headers=head_headers,
        json={"lunch_price": 321.0},
    )
    assert category_response.status_code == 200

    ticket_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": service_day.month, "year": service_day.year},
    )
    assert ticket_response.status_code in {201, 409}

    meal_response = client.post(
        "/api/meals/record",
        headers=cashier_headers,
        json={"code": student["student_card"], "meal_type": "lunch", "issue_date": service_day.isoformat()},
    )

    assert meal_response.status_code == 201
    assert meal_response.get_json()["data"]["price"] == 321.0


def test_saturday_meal_issue_is_allowed_if_not_holiday(client):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    saturday = first_saturday(date.today().replace(day=1))

    student = client.get("/api/students/search", headers=social_headers).get_json()["data"][0]
    meal_type = student["category"]["meal_types"][-1]

    ticket_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": saturday.month, "year": saturday.year},
    )
    assert ticket_response.status_code in {201, 409}

    meal_response = client.post(
        "/api/meals/record",
        headers=cashier_headers,
        json={"code": student["student_card"], "meal_type": meal_type, "issue_date": saturday.isoformat()},
    )

    assert meal_response.status_code == 201


def test_social_ticket_documents_are_available(client):
    social_headers = login(client, "social1")
    current_user = client.get("/api/auth/profile", headers=social_headers)
    assert current_user.status_code == 200
    current_user_name = current_user.get_json()["data"]["full_name"]
    student = client.get("/api/students/search", headers=social_headers).get_json()["data"][0]
    today = date.today()

    create_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": today.month, "year": today.year},
    )
    assert create_response.status_code in {201, 409}

    receipt_response = client.post(
        "/api/tickets/receipt-sheet/document",
        headers=social_headers,
        json={"month": today.month, "year": today.year},
    )
    assert receipt_response.status_code == 200
    assert "html" in receipt_response.get_json()["data"]

    print_response = client.post(
        "/api/tickets/print-sheet/document",
        headers=social_headers,
        json={"month": today.month, "year": today.year},
    )
    assert print_response.status_code == 200
    assert "html" in print_response.get_json()["data"]

    meal_sheet_response = client.post(
        "/api/reports/meal-sheet/document",
        headers=social_headers,
        json={
            "period_start": today.replace(day=1).isoformat(),
            "period_end": today.isoformat(),
            "building_id": 1,
            "status": "active",
        },
    )
    assert meal_sheet_response.status_code == 200
    payload = meal_sheet_response.get_json()["data"]
    assert payload["page_orientation"] == "landscape"
    assert "social-meal-sheet-table" in payload["html"]
    assert "Проверил" not in payload["html"]
    assert current_user_name in payload["html"]


def test_single_ticket_print_document_is_available(client):
    social_headers = login(client, "social1")
    today = date.today()
    student = client.get("/api/students/search", headers=social_headers).get_json()["data"][0]

    create_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": today.month, "year": today.year},
    )
    assert create_response.status_code in {201, 409}

    ticket_id = (
        create_response.get_json()["data"]["id"]
        if create_response.status_code == 201
        else client.get(f"/api/students/{student['id']}/tickets", headers=social_headers).get_json()["data"][0]["id"]
    )

    document_response = client.post(f"/api/tickets/{ticket_id}/document", headers=social_headers)
    assert document_response.status_code == 200
    payload = document_response.get_json()["data"]
    assert "html" in payload
    assert student["full_name"] in payload["html"]
    assert student["group_name"] in payload["html"]
    assert "<svg" in payload["html"]


def test_remote_student_becomes_visible_for_social_after_admin_assigns_meal_building(client):
    social_headers = login(client, "social1")
    admin_headers = login(client, "headsocial")

    visible_before = client.get("/api/students/search", headers=social_headers).get_json()["data"]
    assert all(student["building_id"] == 1 or student["meal_building_id"] == 1 for student in visible_before)
    assert all(student["student_card"] != "100003" for student in visible_before)

    remote_search = client.get("/api/students/search?q=100003", headers=admin_headers)
    assert remote_search.status_code == 200
    remote_student = remote_search.get_json()["data"][0]
    assert remote_student["building_id"] == 2

    update_response = assign_student_meal_building(client, admin_headers, remote_student["id"], 1)
    assert update_response.status_code == 200
    assert update_response.get_json()["data"]["meal_building_id"] == 1
    assert update_response.get_json()["data"]["effective_meal_building_id"] == 1

    visible_after = client.get("/api/students/search", headers=social_headers).get_json()["data"]
    assert any(student["id"] == remote_student["id"] for student in visible_after)


def test_social_default_student_list_keeps_own_students_and_shows_remote_students_served_in_building(client):
    social_headers = login(client, "social1")
    admin_headers = login(client, "headsocial")

    default_students = client.get("/api/students/search", headers=social_headers)
    assert default_students.status_code == 200
    local_student = next(student for student in default_students.get_json()["data"] if student["student_card"] == "100001")
    remote_student = client.get("/api/students/search?q=100003", headers=admin_headers).get_json()["data"][0]

    move_response = assign_student_meal_building(client, admin_headers, local_student["id"], 2)
    assert move_response.status_code == 200
    assert move_response.get_json()["data"]["effective_meal_building_id"] == 2

    remote_assign = assign_student_meal_building(client, admin_headers, remote_student["id"], 1)
    assert remote_assign.status_code == 200

    visible_after = client.get("/api/students/search", headers=social_headers).get_json()["data"]
    assert any(item["id"] == local_student["id"] for item in visible_after)
    assert any(item["id"] == remote_student["id"] for item in visible_after)

    explicit_search = client.get(f"/api/students/search?q={local_student['student_card']}", headers=social_headers)
    assert explicit_search.status_code == 200
    assert any(item["id"] == local_student["id"] for item in explicit_search.get_json()["data"])


def test_social_cannot_issue_ticket_for_remote_student_visible_by_meal_building(client):
    social_headers = login(client, "social1")
    admin_headers = login(client, "headsocial")
    month_reference = date.today().replace(day=1)

    remote_student = client.get("/api/students/search?q=100003", headers=admin_headers).get_json()["data"][0]
    assign_response = assign_student_meal_building(client, admin_headers, remote_student["id"], 1)
    assert assign_response.status_code == 200

    create_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": remote_student["id"], "month": month_reference.month, "year": month_reference.year},
    )

    assert create_response.status_code == 403


def test_ticket_reissue_preserves_existing_meals_for_month(client):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    service_day = first_saturday(date.today().replace(day=1))

    students = client.get("/api/students/search", headers=social_headers).get_json()["data"]
    student = students[0]
    meal_type = student["category"]["meal_types"][-1]

    create_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": service_day.month, "year": service_day.year},
    )
    assert create_response.status_code in {201, 409}
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

    reissue_response = client.post(f"/api/tickets/{ticket_id}/reissue", headers=social_headers)
    assert reissue_response.status_code == 201
    replacement = reissue_response.get_json()["data"]
    assert replacement["id"] != ticket_id
    assert replacement["status"] == "active"

    repeated_issue = client.post(
        "/api/meals/record",
        headers=cashier_headers,
        json={"code": student["student_card"], "meal_type": meal_type, "issue_date": service_day.isoformat()},
    )
    assert repeated_issue.status_code == 409


def test_meals_are_accounted_by_serving_building_for_cashier_and_social_reports(client):
    social_headers = login(client, "social1")
    cashier_headers = login(client, "cashier1")
    admin_headers = login(client, "headsocial")
    service_day = date.today()
    if service_day.weekday() == 6:
        service_day += timedelta(days=1)

    remote_search = client.get("/api/students/search?q=100003", headers=admin_headers)
    assert remote_search.status_code == 200
    remote_student = remote_search.get_json()["data"][0]
    meal_type = remote_student["category"]["meal_types"][-1]

    assign_response = assign_student_meal_building(client, admin_headers, remote_student["id"], 1)
    assert assign_response.status_code == 200

    ticket_response = client.post(
        "/api/tickets",
        headers=admin_headers,
        json={"student_id": remote_student["id"], "month": service_day.month, "year": service_day.year},
    )
    assert ticket_response.status_code in {201, 409}

    meal_response = client.post(
        "/api/meals/record",
        headers=cashier_headers,
        json={"code": remote_student["student_card"], "meal_type": meal_type, "issue_date": service_day.isoformat()},
    )
    assert meal_response.status_code == 201

    today_stats_response = client.get("/api/meals/today-stats", headers=cashier_headers)
    assert today_stats_response.status_code == 200
    assert today_stats_response.get_json()["data"]["mealsToday"] == 1

    building1_report = client.get(
        f"/api/meals/report?start_date={service_day.isoformat()}&end_date={service_day.isoformat()}&building_id=1",
        headers=admin_headers,
    )
    assert building1_report.status_code == 200
    assert building1_report.get_json()["data"]["totals"]["count"] == 1

    building2_report = client.get(
        f"/api/meals/report?start_date={service_day.isoformat()}&end_date={service_day.isoformat()}&building_id=2",
        headers=admin_headers,
    )
    assert building2_report.status_code == 200
    assert building2_report.get_json()["data"]["totals"]["count"] == 0

    building1_document = client.post(
        "/api/reports/meal-sheet/document",
        headers=admin_headers,
        json={
            "period_start": service_day.isoformat(),
            "period_end": service_day.isoformat(),
            "building_id": 1,
            "status": "active",
        },
    )
    assert building1_document.status_code == 200
    assert remote_student["full_name"] in building1_document.get_json()["data"]["html"]

    building2_document = client.post(
        "/api/reports/meal-sheet/document",
        headers=admin_headers,
        json={
            "period_start": service_day.isoformat(),
            "period_end": service_day.isoformat(),
            "building_id": 2,
            "status": "active",
        },
    )
    assert building2_document.status_code == 200
    assert remote_student["full_name"] not in building2_document.get_json()["data"]["html"]


def test_today_stats_for_head_social_defaults_to_all_buildings(client, app):
    create_user(app, username="cashier2", role="cashier", building_id=2)

    head_headers = login(client, "headsocial")
    cashier1_headers = login(client, "cashier1")
    cashier2_headers = login(client, "cashier2")
    service_day = date.today()
    if service_day.weekday() == 6:
        pytest.skip("today-stats aggregates only the current day")

    students = client.get("/api/students/search", headers=head_headers).get_json()["data"]
    building1_student = next(student for student in students if student["effective_meal_building_id"] == 1)
    building2_student = next(student for student in students if student["effective_meal_building_id"] == 2)

    for student in (building1_student, building2_student):
        ticket_response = client.post(
            "/api/tickets",
            headers=head_headers,
            json={"student_id": student["id"], "month": service_day.month, "year": service_day.year},
        )
        assert ticket_response.status_code in {201, 409}

    meal1_response = client.post(
        "/api/meals/record",
        headers=cashier1_headers,
        json={
            "code": building1_student["student_card"],
            "meal_type": building1_student["category"]["meal_types"][-1],
            "issue_date": service_day.isoformat(),
        },
    )
    assert meal1_response.status_code == 201

    meal2_response = client.post(
        "/api/meals/record",
        headers=cashier2_headers,
        json={
            "code": building2_student["student_card"],
            "meal_type": building2_student["category"]["meal_types"][-1],
            "issue_date": service_day.isoformat(),
        },
    )
    assert meal2_response.status_code == 201

    all_stats_response = client.get("/api/meals/today-stats", headers=head_headers)
    building1_stats_response = client.get("/api/meals/today-stats?building_id=1", headers=head_headers)

    assert all_stats_response.status_code == 200
    assert building1_stats_response.status_code == 200

    all_stats = all_stats_response.get_json()["data"]
    building1_stats = building1_stats_response.get_json()["data"]

    assert all_stats["mealsToday"] == 2
    assert building1_stats["mealsToday"] == 1
    assert sum(row["count"] for row in all_stats["byCategory"]) == 2
    assert sum(row["count"] for row in building1_stats["byCategory"]) == 1


def test_social_ticket_list_uses_visible_scope_but_print_documents_keep_meal_building_scope(client):
    social_headers = login(client, "social1")
    admin_headers = login(client, "headsocial")
    month_reference = date.today().replace(day=1)

    remote_search = client.get("/api/students/search?q=100003", headers=admin_headers)
    assert remote_search.status_code == 200
    remote_student = remote_search.get_json()["data"][0]

    assign_remote = assign_student_meal_building(client, admin_headers, remote_student["id"], 1)
    assert assign_remote.status_code == 200

    remote_ticket_response = client.post(
        "/api/tickets",
        headers=admin_headers,
        json={"student_id": remote_student["id"], "month": month_reference.month, "year": month_reference.year},
    )
    assert remote_ticket_response.status_code in {201, 409}

    local_students = client.get("/api/students/search", headers=social_headers).get_json()["data"]
    local_student = next(student for student in local_students if student["building_id"] == 1)

    move_local = client.patch(
        f"/api/students/{local_student['id']}",
        headers=admin_headers,
        json={"meal_building_id": 2},
    )
    assert move_local.status_code == 200

    moved_ticket_response = client.post(
        "/api/tickets",
        headers=admin_headers,
        json={"student_id": local_student["id"], "month": month_reference.month, "year": month_reference.year},
    )
    assert moved_ticket_response.status_code in {201, 409}

    social_list = client.get(
        f"/api/tickets?month={month_reference.month}&year={month_reference.year}",
        headers=social_headers,
    )
    assert social_list.status_code == 200
    social_ticket_rows = social_list.get_json()["data"]

    remote_ticket = next(row for row in social_ticket_rows if row["student_id"] == remote_student["id"])
    assert remote_ticket["building_id"] == 1
    assert remote_ticket["source_building_id"] == 2
    assert any(row["student_id"] == local_student["id"] for row in social_ticket_rows)

    admin_building1 = client.get(
        f"/api/tickets?month={month_reference.month}&year={month_reference.year}&building_id=1",
        headers=admin_headers,
    )
    assert admin_building1.status_code == 200
    building1_rows = admin_building1.get_json()["data"]
    assert any(row["student_id"] == remote_student["id"] for row in building1_rows)
    assert all(row["student_id"] != local_student["id"] for row in building1_rows)

    admin_building2 = client.get(
        f"/api/tickets?month={month_reference.month}&year={month_reference.year}&building_id=2",
        headers=admin_headers,
    )
    assert admin_building2.status_code == 200
    building2_rows = admin_building2.get_json()["data"]
    assert any(row["student_id"] == local_student["id"] for row in building2_rows)
    assert all(row["student_id"] != remote_student["id"] for row in building2_rows)

    receipt_document = client.post(
        "/api/tickets/receipt-sheet/document",
        headers=social_headers,
        json={"month": month_reference.month, "year": month_reference.year},
    )
    assert receipt_document.status_code == 200
    receipt_html = receipt_document.get_json()["data"]["html"]
    assert remote_student["full_name"] in receipt_html
    assert local_student["full_name"] not in receipt_html

    print_document = client.post(
        "/api/tickets/print-sheet/document",
        headers=social_headers,
        json={"month": month_reference.month, "year": month_reference.year},
    )
    assert print_document.status_code == 200
    print_html = print_document.get_json()["data"]["html"]
    assert remote_student["full_name"] in print_html
    assert local_student["full_name"] not in print_html
    assert "<svg" in print_html


def test_student_with_all_buildings_access_is_still_unavailable_for_foreign_cashier(client, app):
    create_user(app, username="cashier2", role="cashier", building_id=2)

    social_headers = login(client, "social1")
    cashier2_headers = login(client, "cashier2")
    service_day = first_saturday(date.today().replace(day=1))

    student = client.get("/api/students/search?q=100002", headers=social_headers).get_json()["data"][0]
    meal_type = student["category"]["meal_types"][-1]

    update_response = client.patch(
        f"/api/students/{student['id']}",
        headers=social_headers,
        json={"allow_all_meal_buildings": True},
    )
    assert update_response.status_code == 200
    assert update_response.get_json()["data"]["allow_all_meal_buildings"] is True

    ticket_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": student["id"], "month": service_day.month, "year": service_day.year},
    )
    assert ticket_response.status_code in {201, 409}

    lookup_response = client.get(f"/api/meals/resolve?query={student['student_card']}", headers=cashier2_headers)
    assert lookup_response.status_code == 403

    meal_response = client.post(
        "/api/meals/record",
        headers=cashier2_headers,
        json={"code": student["student_card"], "meal_type": meal_type, "issue_date": service_day.isoformat()},
    )
    assert meal_response.status_code == 403
