from __future__ import annotations

from sqlalchemy.exc import IntegrityError

from app.models import Category, Student, User, db
from app.services.student_cards import generate_next_student_card
from app.utils.audit import log_action


class StudentCreationError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def parse_required_text(payload: dict, field_name: str, label: str) -> str:
    value = (payload.get(field_name) or "").strip()
    if not value:
        raise StudentCreationError(f"Не заполнено поле: {label}")
    return value


def parse_int_field(value, field_name: str, *, allow_empty: bool = False) -> int | None:
    if value in {None, ""}:
        if allow_empty:
            return None
        raise StudentCreationError(f"Некорректное значение поля {field_name}")

    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise StudentCreationError(f"Некорректное значение поля {field_name}") from exc


def ensure_student_building_access(user: User, building_id: int) -> None:
    if user.role == "social" and user.building_id != building_id:
        raise StudentCreationError("Доступ к корпусу запрещен", status_code=403)


def find_category(category_id: int) -> Category:
    category = Category.query.filter_by(id=category_id, is_active=True).first()
    if not category:
        raise StudentCreationError("Категория не найдена", status_code=404)
    return category


def create_student(current_user: User, payload: dict) -> Student:
    full_name = parse_required_text(payload, "full_name", "ФИО")
    group_name = parse_required_text(payload, "group_name", "группа")
    building_id = parse_int_field(payload.get("building_id"), "building_id")
    assert building_id is not None
    ensure_student_building_access(current_user, building_id)

    category_id = parse_int_field(payload.get("category_id"), "category_id")
    assert category_id is not None
    category = find_category(category_id)

    meal_building_id = parse_int_field(payload.get("meal_building_id"), "meal_building_id", allow_empty=True)
    allow_all_meal_buildings = bool(payload.get("allow_all_meal_buildings", False))

    student = Student(
        full_name=full_name,
        student_card=generate_next_student_card(db.session),
        group_name=group_name,
        building_id=building_id,
        meal_building_id=meal_building_id,
        allow_all_meal_buildings=allow_all_meal_buildings,
        category_id=category.id,
        is_active=bool(payload.get("is_active", True)),
    )

    try:
        db.session.add(student)
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise StudentCreationError("Конфликт данных студента", status_code=409) from exc

    log_action(
        current_user,
        "create_student",
        "student",
        student.id,
        {
            "building_id": student.building_id,
            "meal_building_id": student.meal_building_id,
            "allow_all_meal_buildings": student.allow_all_meal_buildings,
            "category_id": student.category_id,
        },
    )
    return student
