from __future__ import annotations

from datetime import date


def login(client, username: str, password: str = "password123") -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    token = response.get_json()["data"]["token"]
    return {"Authorization": f"Bearer {token}"}


def test_head_social_can_rename_category_without_changing_code(client):
    headers = login(client, "headsocial")

    response = client.patch(
        "/api/categories/4",
        headers=headers,
        json={"name": "Mobility Support"},
    )

    assert response.status_code == 200
    category = response.get_json()["data"]
    assert category["name"] == "Mobility Support"
    assert category["code"] == "disabled"


def test_head_social_can_update_category_code(client):
    headers = login(client, "headsocial")

    response = client.patch(
        "/api/categories/4",
        headers=headers,
        json={"code": "mobility"},
    )

    assert response.status_code == 200
    category = response.get_json()["data"]
    assert category["name"] == "Инвалиды"
    assert category["code"] == "mobility"


def test_social_cannot_rename_category(client):
    headers = login(client, "social1")

    response = client.patch(
        "/api/categories/4",
        headers=headers,
        json={"name": "Mobility Support"},
    )

    assert response.status_code == 403


def test_archive_category_requires_replacement_for_assigned_students(client):
    headers = login(client, "headsocial")

    response = client.delete("/api/categories/2", headers=headers, json={})

    assert response.status_code == 400
    assert "категорию-замену" in response.get_json()["error"]


def test_head_social_can_archive_category_and_transfer_students(client):
    headers = login(client, "headsocial")
    students_before = client.get("/api/students/search?q=100001", headers=headers).get_json()["data"]
    student_id = students_before[0]["id"]
    today = date.today()

    ticket_response = client.post(
        "/api/tickets",
        headers=headers,
        json={"student_id": student_id, "month": today.month, "year": today.year},
    )
    assert ticket_response.status_code == 201

    response = client.delete(
        "/api/categories/2",
        headers=headers,
        json={"replacement_category_id": 1},
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["id"] == 2
    assert payload["replacement_category_id"] == 1
    assert payload["transferred_students"] == 1

    categories = client.get("/api/categories", headers=headers).get_json()["data"]
    assert all(category["id"] != 2 for category in categories)

    students = client.get("/api/students/search?q=100001", headers=headers).get_json()["data"]
    assert students[0]["category_id"] == 1

    tickets = client.get(f"/api/students/{students[0]['id']}/tickets", headers=headers).get_json()["data"]
    assert tickets[0]["category_id"] == 1


def test_head_social_can_create_student_for_any_building(client):
    headers = login(client, "headsocial")

    response = client.post(
        "/api/students",
        headers=headers,
        json={
            "full_name": "New Managed Student",
            "group_name": "TEST-201",
            "building_id": 2,
            "category_id": 4,
        },
    )

    assert response.status_code == 201
    student = response.get_json()["data"]
    assert student["full_name"] == "New Managed Student"
    assert student["group_name"] == "TEST-201"
    assert student["building_id"] == 2
    assert student["category_id"] == 4
    assert student["student_card"].isdigit()


def test_social_cannot_create_student_for_another_building(client):
    headers = login(client, "social1")

    response = client.post(
        "/api/students",
        headers=headers,
        json={
            "full_name": "Remote Student",
            "group_name": "TEST-202",
            "building_id": 2,
            "category_id": 4,
        },
    )

    assert response.status_code == 403
