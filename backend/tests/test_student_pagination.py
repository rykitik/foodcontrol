from __future__ import annotations

from app.models import Category, Student, db


def login(client, username: str, password: str = "password123") -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    token = response.get_json()["data"]["token"]
    return {"Authorization": f"Bearer {token}"}


def seed_many_students(app, count: int = 60) -> None:
    with app.app_context():
        category = Category.query.first()
        assert category is not None
        existing_cards = {student.student_card for student in Student.query.all()}

        students_to_add: list[Student] = []
        for index in range(count):
            student_card = f"77{index:04d}"
            if student_card in existing_cards:
                continue
            students_to_add.append(
                Student(
                    full_name=f"Pagination Student {index:03d}",
                    student_card=student_card,
                    group_name="PAG-101",
                    building_id=1,
                    category_id=category.id,
                    is_active=True,
                )
            )

        if students_to_add:
            db.session.add_all(students_to_add)
            db.session.commit()


def test_students_endpoint_returns_paginated_payload(client, app):
    seed_many_students(app)
    admin_headers = login(client, "admin")

    response = client.get("/api/students?page=1&page_size=25", headers=admin_headers)

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["page"] == 1
    assert payload["page_size"] == 25
    assert payload["total"] >= 60
    assert len(payload["items"]) == 25


def test_students_endpoint_returns_later_pages_beyond_old_limit(client, app):
    seed_many_students(app)
    admin_headers = login(client, "admin")

    first_page_response = client.get("/api/students?page=1&page_size=25&q=Pagination Student", headers=admin_headers)
    third_page_response = client.get("/api/students?page=3&page_size=25&q=Pagination Student", headers=admin_headers)

    assert first_page_response.status_code == 200
    assert third_page_response.status_code == 200

    first_page = first_page_response.get_json()["data"]
    third_page = third_page_response.get_json()["data"]
    first_page_ids = {item["id"] for item in first_page["items"]}
    third_page_ids = {item["id"] for item in third_page["items"]}

    assert first_page["total"] >= 60
    assert third_page["page"] == 3
    assert len(third_page["items"]) >= 10
    assert first_page_ids.isdisjoint(third_page_ids)


def test_students_endpoint_returns_total_zero_for_empty_search(client):
    admin_headers = login(client, "admin")

    response = client.get("/api/students?page=1&page_size=25&q=no-such-student", headers=admin_headers)

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["total"] == 0
    assert payload["items"] == []


def test_students_endpoint_can_return_inactive_students_for_reactivation(client, app):
    with app.app_context():
        student = Student.query.filter_by(student_card="100001").first()
        assert student is not None
        student.is_active = False
        db.session.commit()
        student_id = student.id

    admin_headers = login(client, "admin")

    active_only_response = client.get("/api/students?page=1&page_size=25&q=100001", headers=admin_headers)
    inactive_only_response = client.get("/api/students?page=1&page_size=25&q=100001&status=inactive", headers=admin_headers)
    all_statuses_response = client.get("/api/students?page=1&page_size=25&q=100001&status=all", headers=admin_headers)

    assert active_only_response.status_code == 200
    assert inactive_only_response.status_code == 200
    assert all_statuses_response.status_code == 200
    assert active_only_response.get_json()["data"]["items"] == []

    inactive_items = inactive_only_response.get_json()["data"]["items"]
    all_items = all_statuses_response.get_json()["data"]["items"]

    assert len(inactive_items) == 1
    assert inactive_items[0]["id"] == student_id
    assert inactive_items[0]["is_active"] is False
    assert len(all_items) == 1
    assert all_items[0]["id"] == student_id
    assert all_items[0]["is_active"] is False


def test_social_students_endpoint_preserves_existing_scope_rules(client):
    social_headers = login(client, "social1")
    admin_headers = login(client, "admin")

    remote_student = client.get("/api/students?page=1&page_size=25&q=100003", headers=admin_headers).get_json()["data"]["items"][0]
    assign_response = client.patch(
        f"/api/students/{remote_student['id']}",
        headers=admin_headers,
        json={"meal_building_id": 1},
    )
    assert assign_response.status_code == 200

    local_response = client.get("/api/students?page=1&page_size=100", headers=social_headers)
    own_student_moved = client.patch(
        f"/api/students/{local_response.get_json()['data']['items'][0]['id']}",
        headers=admin_headers,
        json={"meal_building_id": 2},
    )
    assert own_student_moved.status_code == 200

    refreshed_local_response = client.get("/api/students?page=1&page_size=100", headers=social_headers)
    remote_search_response = client.get("/api/students?page=1&page_size=25&q=100003", headers=social_headers)

    assert refreshed_local_response.status_code == 200
    assert remote_search_response.status_code == 200

    local_items = refreshed_local_response.get_json()["data"]["items"]
    remote_items = remote_search_response.get_json()["data"]["items"]

    assert any(item["building_id"] == 1 and item["effective_meal_building_id"] == 2 for item in local_items)
    assert all(item["building_id"] == 1 or item["meal_building_id"] == 1 for item in local_items)
    assert any(item["student_card"] == "100003" for item in remote_items)
