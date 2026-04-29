from __future__ import annotations

from app.models import Student, db
from app.services.student_cards import generate_next_student_card


def login(client, username: str, password: str = "password123") -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    token = response.get_json()["data"]["token"]
    return {"Authorization": f"Bearer {token}"}


def build_student_payload(**overrides):
    payload = {
        "full_name": "Тестовый студент",
        "group_name": "ТЕСТ-101",
        "building_id": 1,
        "category_id": 1,
    }
    payload.update(overrides)
    return payload


def student_by_card(card: str) -> Student:
    student = Student.query.filter_by(student_card=card).first()
    assert student is not None
    return student


def test_create_student_generates_sequential_student_cards_and_ignores_manual_input(client, app):
    headers = login(client, "admin")

    with app.app_context():
        expected_first_student_card = generate_next_student_card(db.session)
        expected_second_student_card = str(int(expected_first_student_card) + 1)

    first_response = client.post(
        "/api/students",
        headers=headers,
        json=build_student_payload(full_name="Первый студент", student_card="999999"),
    )
    second_response = client.post(
        "/api/students",
        headers=headers,
        json=build_student_payload(full_name="Второй студент"),
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 201

    first_student = first_response.get_json()["data"]
    second_student = second_response.get_json()["data"]

    assert first_student["student_card"] == expected_first_student_card
    assert second_student["student_card"] == expected_second_student_card

    with app.app_context():
        assert Student.query.filter_by(id=first_student["id"]).first().student_card == expected_first_student_card
        assert Student.query.filter_by(id=second_student["id"]).first().student_card == expected_second_student_card


def test_update_student_returns_409_for_duplicate_student_card_and_rolls_back_changes(client, app):
    headers = login(client, "admin")

    with app.app_context():
        target_student = student_by_card("100002")
        target_student_id = target_student.id

    response = client.patch(
        f"/api/students/{target_student_id}",
        headers=headers,
        json={"student_card": "100001", "group_name": "Должно откатиться"},
    )

    assert response.status_code == 409
    assert "error" in response.get_json()

    with app.app_context():
        reloaded = Student.query.filter_by(id=target_student_id).first()
        assert reloaded is not None
        assert reloaded.student_card == "100002"
        assert reloaded.group_name != "Должно откатиться"


def test_create_student_returns_400_for_invalid_building_id(client, app):
    headers = login(client, "admin")
    full_name = "Invalid Building Student"

    response = client.post(
        "/api/students",
        headers=headers,
        json=build_student_payload(full_name=full_name, building_id="invalid"),
    )

    assert response.status_code == 400
    assert "error" in response.get_json()

    with app.app_context():
        assert Student.query.filter_by(full_name=full_name).first() is None


def test_update_student_returns_400_for_invalid_building_id(client, app):
    headers = login(client, "admin")

    with app.app_context():
        target_student = student_by_card("100001")
        target_student_id = target_student.id
        original_building_id = target_student.building_id

    response = client.patch(
        f"/api/students/{target_student_id}",
        headers=headers,
        json={"building_id": "invalid"},
    )

    assert response.status_code == 400
    assert "error" in response.get_json()

    with app.app_context():
        reloaded = Student.query.filter_by(id=target_student_id).first()
        assert reloaded is not None
        assert reloaded.building_id == original_building_id


def test_update_student_returns_400_for_invalid_meal_building_id(client, app):
    headers = login(client, "admin")

    with app.app_context():
        target_student = student_by_card("100001")
        target_student_id = target_student.id
        original_meal_building_id = target_student.meal_building_id

    response = client.patch(
        f"/api/students/{target_student_id}",
        headers=headers,
        json={"meal_building_id": "invalid"},
    )

    assert response.status_code == 400
    assert "error" in response.get_json()

    with app.app_context():
        reloaded = Student.query.filter_by(id=target_student_id).first()
        assert reloaded is not None
        assert reloaded.meal_building_id == original_meal_building_id
