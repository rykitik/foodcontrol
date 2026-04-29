from __future__ import annotations

from sqlalchemy import inspect

from app import create_app
from app.models import Category, Student, User
import app.runtime_bootstrap as runtime_bootstrap_module


def test_bootstrap_runtime_environment_runs_migrations_and_seeding_in_order(monkeypatch):
    application = create_app(
        config_overrides={
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "DEMO_USER_PASSWORD": "dev-pass",
        }
    )
    calls: list[object] = []

    monkeypatch.setattr(runtime_bootstrap_module, "apply_database_migrations", lambda: calls.append("upgrade"))

    def track_seed(*, demo_user_password: str | None = None):
        calls.append(("seed_database", demo_user_password))

    monkeypatch.setattr(runtime_bootstrap_module, "seed_database", track_seed)

    runtime_bootstrap_module.bootstrap_runtime_environment(application)

    assert calls == [
        "upgrade",
        ("seed_database", "dev-pass"),
    ]


def test_bootstrap_runtime_environment_seeds_base_data_without_demo_password(monkeypatch):
    application = create_app(
        config_overrides={
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "DEMO_USER_PASSWORD": None,
        }
    )
    calls: list[object] = []

    monkeypatch.setattr(runtime_bootstrap_module, "apply_database_migrations", lambda: calls.append("upgrade"))

    def track_seed(*, demo_user_password: str | None = None):
        calls.append(("seed_database", demo_user_password))

    monkeypatch.setattr(runtime_bootstrap_module, "seed_database", track_seed)

    runtime_bootstrap_module.bootstrap_runtime_environment(application)

    assert calls == [
        "upgrade",
        ("seed_database", None),
    ]


def test_bootstrap_runtime_environment_applies_real_migrations_and_seed_data(tmp_path):
    database_path = tmp_path / "runtime-bootstrap.sqlite"
    application = create_app(
        config_overrides={
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{database_path.as_posix()}",
            "DEMO_USER_PASSWORD": "dev-pass",
        }
    )

    runtime_bootstrap_module.bootstrap_runtime_environment(application)

    with application.app_context():
        inspector = inspect(application.extensions["sqlalchemy"].engine)
        category_columns = {column["name"] for column in inspector.get_columns("categories")}
        student_columns = {column["name"] for column in inspector.get_columns("students")}

        assert "holiday_calendar" in inspector.get_table_names()
        assert "breakfast_price" in category_columns
        assert "lunch_price" in category_columns
        assert "meal_building_id" in student_columns
        assert "allow_all_meal_buildings" in student_columns
        assert Category.query.count() == 6
        assert Category.query.filter_by(code="svo").first() is not None
        assert Student.query.count() == 3
        assert User.query.count() == 5

    client = application.test_client()
    login_response = client.post("/api/auth/login", json={"username": "headsocial", "password": "dev-pass"})

    assert login_response.status_code == 200
    token = login_response.get_json()["data"]["token"]

    holidays_response = client.get(
        "/api/holidays",
        headers={"Authorization": f"Bearer {token}"},
        query_string={"year": 2026, "month": 4},
    )

    assert holidays_response.status_code == 200
    assert isinstance(holidays_response.get_json()["data"], list)
