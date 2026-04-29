from __future__ import annotations

from flask import current_app
from sqlalchemy import func

from app.models import Category, Student, User, db
from app.services.database_sequences import sync_postgresql_integer_pk_sequence


CATEGORY_SEED = [
    {
        "id": 1,
        "name": "ОВЗ",
        "code": "ovz",
        "breakfast": True,
        "lunch": True,
        "dinner": False,
        "breakfast_price": 95.0,
        "lunch_price": 165.0,
        "description": "Студенты с ограниченными возможностями здоровья",
        "color": "#2563eb",
        "is_active": True,
    },
    {
        "id": 2,
        "name": "Сироты",
        "code": "orphan",
        "breakfast": False,
        "lunch": True,
        "dinner": False,
        "breakfast_price": 95.0,
        "lunch_price": 175.0,
        "description": "Дети-сироты и оставшиеся без попечения родителей",
        "color": "#7c3aed",
        "is_active": True,
    },
    {
        "id": 3,
        "name": "Многодетные",
        "code": "large_family",
        "breakfast": True,
        "lunch": True,
        "dinner": False,
        "breakfast_price": 95.0,
        "lunch_price": 150.0,
        "description": "Студенты из многодетных семей",
        "color": "#ea580c",
        "is_active": True,
    },
    {
        "id": 4,
        "name": "Инвалиды",
        "code": "disabled",
        "breakfast": False,
        "lunch": True,
        "dinner": False,
        "breakfast_price": 90.0,
        "lunch_price": 165.0,
        "description": "Студенты с инвалидностью",
        "color": "#dc2626",
        "is_active": True,
    },
    {
        "id": 5,
        "name": "Малообеспеченные",
        "code": "low_income",
        "breakfast": False,
        "lunch": True,
        "dinner": False,
        "breakfast_price": 95.0,
        "lunch_price": 150.0,
        "description": "Студенты из малообеспеченных семей",
        "color": "#059669",
        "is_active": True,
    },
    {
        "name": "СВО",
        "code": "svo",
        "breakfast": False,
        "lunch": True,
        "dinner": False,
        "breakfast_price": 95.0,
        "lunch_price": 150.0,
        "description": "Дети участников СВО",
        "color": "#475569",
        "is_active": True,
    },
]

USER_SEED = [
    {
        "username": "social1",
        "full_name": "Соколова Елена Викторовна",
        "role": "social",
        "building_id": 1,
        "email": "social1@foodcontrol.local",
    },
    {
        "username": "cashier1",
        "full_name": "Орлова Марина Петровна",
        "role": "cashier",
        "building_id": 1,
        "email": "cashier1@foodcontrol.local",
    },
    {
        "username": "accountant",
        "full_name": "Кузнецова Анна Сергеевна",
        "role": "accountant",
        "building_id": None,
        "email": "accountant@foodcontrol.local",
    },
    {
        "username": "headsocial",
        "full_name": "Иванова Татьяна Андреевна",
        "role": "head_social",
        "building_id": None,
        "email": "headsocial@foodcontrol.local",
    },
    {
        "username": "admin",
        "full_name": "Администратор",
        "role": "admin",
        "building_id": None,
        "email": "admin@foodcontrol.local",
    },
]

STUDENT_SEED = [
    {
        "full_name": "Иванов Иван Иванович",
        "student_card": "100001",
        "group_name": "ИСП-201",
        "building_id": 1,
        "category_id": 2,
    },
    {
        "full_name": "Петров Петр Петрович",
        "student_card": "100002",
        "group_name": "ПКС-301",
        "building_id": 1,
        "category_id": 1,
    },
    {
        "full_name": "Сидорова Мария Сергеевна",
        "student_card": "100003",
        "group_name": "ОП-202",
        "building_id": 2,
        "category_id": 3,
    },
]


def resolve_demo_user_password(demo_user_password: str | None) -> str | None:
    if demo_user_password:
        return demo_user_password

    if current_app.config.get("TESTING"):
        return "password123"

    return current_app.config.get("DEMO_USER_PASSWORD")


def _merge_seeded_category(existing_category: Category, payload: dict) -> None:
    existing_category.breakfast_price = (
        existing_category.breakfast_price
        if existing_category.breakfast_price is not None
        else payload["breakfast_price"]
    )
    existing_category.lunch_price = (
        existing_category.lunch_price
        if existing_category.lunch_price is not None
        else payload["lunch_price"]
    )
    existing_category.description = existing_category.description or payload["description"]
    existing_category.color = existing_category.color or payload["color"]


def _seed_categories() -> None:
    manual_id_categories: list[dict] = []
    generated_id_categories: list[dict] = []

    for item in CATEGORY_SEED:
        category = Category.query.filter_by(code=item["code"]).first()
        if category is None:
            if "id" in item:
                manual_id_categories.append(item)
            else:
                generated_id_categories.append(item)
            continue

        _merge_seeded_category(category, item)

    for item in manual_id_categories:
        db.session.add(Category(**item))

    if manual_id_categories:
        db.session.flush()

    if generated_id_categories:
        sync_postgresql_integer_pk_sequence(Category)
        for item in generated_id_categories:
            db.session.add(Category(**item))

    if manual_id_categories or generated_id_categories:
        db.session.flush()
        sync_postgresql_integer_pk_sequence(Category)


def _seed_demo_users(demo_user_password: str) -> None:
    for seed in USER_SEED:
        payload = seed.copy()
        payload.pop("password", None)
        username = (payload["username"] or "").strip().lower()
        payload["username"] = username

        user = User.query.filter(func.lower(User.username) == username).first()
        if user is None:
            user = User(**payload)
            user.set_password(demo_user_password)
            db.session.add(user)


def _seed_demo_students() -> None:
    if Student.query.first():
        return

    for item in STUDENT_SEED:
        db.session.add(Student(**item))


def seed_database(*, include_demo_users: bool | None = None, demo_user_password: str | None = None):
    resolved_demo_user_password = resolve_demo_user_password(demo_user_password)
    if include_demo_users is None:
        include_demo_users = resolved_demo_user_password is not None

    if include_demo_users and not resolved_demo_user_password:
        raise ValueError("Explicit demo user password is required to seed demo users outside testing.")

    _seed_categories()

    if include_demo_users:
        _seed_demo_users(resolved_demo_user_password)

    _seed_demo_students()

    db.session.commit()
