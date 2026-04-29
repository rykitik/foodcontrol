from __future__ import annotations

from sqlalchemy import and_, or_

from app.models import Student
from app.utils.buildings import building_name


def get_effective_meal_building_id(student: Student) -> int | None:
    return student.meal_building_id or student.building_id


def has_all_meal_buildings_access(student: Student) -> bool:
    return bool(getattr(student, "allow_all_meal_buildings", False))


def get_social_visible_building_ids(student: Student) -> set[int]:
    building_ids = {student.building_id}
    if student.meal_building_id:
        building_ids.add(student.meal_building_id)
    return building_ids


def has_student_access(user, student: Student) -> bool:
    if user.role == "social":
        return user.building_id in get_social_visible_building_ids(student)
    if user.role == "cashier":
        return user.building_id == get_effective_meal_building_id(student)
    return True


def build_student_access_error_message(user, student: Student) -> str:
    if user.role != "cashier":
        return "Доступ к студенту запрещен"

    meal_building_label = building_name(get_effective_meal_building_id(student))
    if meal_building_label:
        return f"Студент питается в другом корпусе. Питание назначено в: {meal_building_label}."

    return "Студент питается в другом корпусе. Питание назначено по другому корпусу питания."


def has_student_management_access(user, student: Student) -> bool:
    if user.role == "social":
        return user.building_id == student.building_id
    return has_student_access(user, student)


def visible_to_social_building_expr(building_id: int):
    return or_(Student.building_id == building_id, Student.meal_building_id == building_id)


def assigned_to_meal_building_expr(building_id: int):
    return or_(
        Student.meal_building_id == building_id,
        and_(Student.meal_building_id.is_(None), Student.building_id == building_id),
    )


def available_for_cashier_building_expr(building_id: int):
    return assigned_to_meal_building_expr(building_id)
