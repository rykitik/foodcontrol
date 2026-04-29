from __future__ import annotations

from datetime import date

from app.models import Student


def login(client, username: str, password: str = "password123") -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    token = response.get_json()["data"]["token"]
    return {"Authorization": f"Bearer {token}"}


def student_by_card(card: str) -> Student:
    student = Student.query.filter_by(student_card=card).first()
    assert student is not None
    return student


def assign_student_meal_building(client, headers: dict[str, str], student_id: str, meal_building_id: int | None):
    return client.patch(
        f"/api/students/{student_id}",
        headers=headers,
        json={"meal_building_id": meal_building_id},
    )


def test_social_cannot_enable_all_buildings_access_for_remote_student(client, app):
    social_headers = login(client, "social1")

    with app.app_context():
        remote_student = student_by_card("100003")
        assert remote_student.building_id == 2
        assert remote_student.allow_all_meal_buildings is False
        remote_student_id = remote_student.id

    response = client.patch(
        f"/api/students/{remote_student_id}",
        headers=social_headers,
        json={"allow_all_meal_buildings": True},
    )

    assert response.status_code == 403
    assert "error" in response.get_json()

    with app.app_context():
        reloaded = Student.query.filter_by(id=remote_student_id).first()
        assert reloaded is not None
        assert reloaded.allow_all_meal_buildings is False


def test_social_can_assign_any_meal_building_for_own_student(client):
    social_headers = login(client, "social1")
    local_student = client.get("/api/students/search?q=100001", headers=social_headers).get_json()["data"][0]

    response = client.patch(
        f"/api/students/{local_student['id']}",
        headers=social_headers,
        json={"meal_building_id": 2},
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["building_id"] == 1
    assert payload["meal_building_id"] == 2
    assert payload["effective_meal_building_id"] == 2


def test_social_cannot_manage_remote_student_even_when_visible_in_own_meal_building(client):
    social_headers = login(client, "social1")
    head_headers = login(client, "headsocial")

    remote_student = client.get("/api/students/search?q=100003", headers=head_headers).get_json()["data"][0]
    assign_response = assign_student_meal_building(client, head_headers, remote_student["id"], 1)
    assert assign_response.status_code == 200

    visible_remote = client.get("/api/students/search?q=100003", headers=social_headers)
    assert visible_remote.status_code == 200
    assert visible_remote.get_json()["data"][0]["id"] == remote_student["id"]

    update_response = client.patch(
        f"/api/students/{remote_student['id']}",
        headers=social_headers,
        json={"meal_building_id": 2},
    )
    detail_response = client.get(f"/api/students/{remote_student['id']}", headers=social_headers)

    assert update_response.status_code == 403
    assert detail_response.status_code == 403


def test_social_can_still_enable_all_buildings_access_for_visible_student(client):
    social_headers = login(client, "social1")
    local_student = client.get("/api/students/search?q=100001", headers=social_headers).get_json()["data"][0]

    response = client.patch(
        f"/api/students/{local_student['id']}",
        headers=social_headers,
        json={"allow_all_meal_buildings": True},
    )

    assert response.status_code == 200
    assert response.get_json()["data"]["allow_all_meal_buildings"] is True


def test_social_meal_sheet_document_defaults_to_own_building_scope(client):
    social_headers = login(client, "social1")
    head_headers = login(client, "headsocial")
    period_day = date.today().replace(day=1)

    local_student = client.get("/api/students/search?q=100001", headers=social_headers).get_json()["data"][0]
    remote_student = client.get("/api/students/search?q=100003", headers=head_headers).get_json()["data"][0]

    local_ticket_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": local_student["id"], "month": period_day.month, "year": period_day.year},
    )
    assert local_ticket_response.status_code in {201, 409}

    remote_ticket_response = client.post(
        "/api/tickets",
        headers=head_headers,
        json={"student_id": remote_student["id"], "month": period_day.month, "year": period_day.year},
    )
    assert remote_ticket_response.status_code in {201, 409}

    response = client.post(
        "/api/reports/meal-sheet/document",
        headers=social_headers,
        json={"period_start": period_day.isoformat(), "period_end": period_day.isoformat()},
    )

    assert response.status_code == 200
    document = response.get_json()["data"]
    assert "html" in document
    assert "Корпус 1" in document["html"]
    assert local_student["full_name"] in document["html"]
    assert remote_student["full_name"] not in document["html"]
    assert "Все корпуса" not in document["html"]


def test_social_meal_sheet_document_ignores_foreign_building_id(client):
    social_headers = login(client, "social1")
    head_headers = login(client, "headsocial")
    period_day = date.today().replace(day=1)

    local_student = client.get("/api/students/search?q=100001", headers=social_headers).get_json()["data"][0]
    remote_student = client.get("/api/students/search?q=100003", headers=head_headers).get_json()["data"][0]

    local_ticket_response = client.post(
        "/api/tickets",
        headers=social_headers,
        json={"student_id": local_student["id"], "month": period_day.month, "year": period_day.year},
    )
    assert local_ticket_response.status_code in {201, 409}

    remote_ticket_response = client.post(
        "/api/tickets",
        headers=head_headers,
        json={"student_id": remote_student["id"], "month": period_day.month, "year": period_day.year},
    )
    assert remote_ticket_response.status_code in {201, 409}

    response = client.post(
        "/api/reports/meal-sheet/document",
        headers=social_headers,
        json={"period_start": period_day.isoformat(), "period_end": period_day.isoformat(), "building_id": 2},
    )

    assert response.status_code == 200
    document = response.get_json()["data"]
    assert "html" in document
    assert "Корпус 1" in document["html"]
    assert local_student["full_name"] in document["html"]
    assert remote_student["full_name"] not in document["html"]
    assert "Все корпуса" not in document["html"]


def test_admin_can_still_request_cross_building_meal_sheet_document(client):
    social_headers = login(client, "social1")
    admin_headers = login(client, "admin")
    period_day = date.today().replace(day=1)

    local_student = client.get("/api/students/search?q=100001", headers=social_headers).get_json()["data"][0]
    remote_student = client.get("/api/students/search?q=100003", headers=admin_headers).get_json()["data"][0]

    local_ticket_response = client.post(
        "/api/tickets",
        headers=admin_headers,
        json={"student_id": local_student["id"], "month": period_day.month, "year": period_day.year},
    )
    assert local_ticket_response.status_code in {201, 409}

    remote_ticket_response = client.post(
        "/api/tickets",
        headers=admin_headers,
        json={"student_id": remote_student["id"], "month": period_day.month, "year": period_day.year},
    )
    assert remote_ticket_response.status_code in {201, 409}

    response = client.post(
        "/api/reports/meal-sheet/document",
        headers=admin_headers,
        json={"period_start": period_day.isoformat(), "period_end": period_day.isoformat()},
    )

    assert response.status_code == 200
    document = response.get_json()["data"]
    assert local_student["full_name"] in document["html"]
    assert remote_student["full_name"] in document["html"]
    assert "Все корпуса" in document["html"]
