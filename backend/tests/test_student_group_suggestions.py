from __future__ import annotations

from app.models import Category, Student, db


def login(client, username: str, password: str = "password123") -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    token = response.get_json()["data"]["token"]
    return {"Authorization": f"Bearer {token}"}


def test_student_group_suggestions_return_distinct_saved_group_names(client, app):
    with app.app_context():
        category = Category.query.first()
        assert category is not None
        db.session.add(
            Student(
                full_name="Duplicate Group Student",
                student_card="880001",
                group_name="исп-201",
                building_id=1,
                category_id=category.id,
                is_active=True,
            )
        )
        db.session.commit()

    admin_headers = login(client, "admin")

    response = client.get("/api/students/meta/groups", headers=admin_headers)

    assert response.status_code == 200
    group_names = response.get_json()["data"]
    assert {"ИСП-201", "ПКС-301", "ОП-202"}.issubset(set(group_names))
    assert sum(1 for group_name in group_names if group_name.casefold() == "исп-201") == 1


def test_student_group_suggestions_filter_by_query_and_social_building(client):
    admin_headers = login(client, "admin")
    social_headers = login(client, "social1")

    admin_response = client.get("/api/students/meta/groups?q=ОП&building_id=2", headers=admin_headers)
    social_response = client.get("/api/students/meta/groups?q=ОП", headers=social_headers)

    assert admin_response.status_code == 200
    assert social_response.status_code == 200
    assert admin_response.get_json()["data"] == ["ОП-202"]
    assert social_response.get_json()["data"] == []


def test_created_student_group_is_available_as_suggestion(client):
    admin_headers = login(client, "admin")

    create_response = client.post(
        "/api/students",
        headers=admin_headers,
        json={
            "full_name": "Новый Студент Для Группы",
            "group_name": "КМТ-909",
            "building_id": 1,
            "category_id": 1,
        },
    )
    group_response = client.get("/api/students/meta/groups?q=КМТ", headers=admin_headers)

    assert create_response.status_code == 201
    assert group_response.status_code == 200
    assert group_response.get_json()["data"] == ["КМТ-909"]
