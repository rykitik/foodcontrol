from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config as AlembicConfig
from flask import Flask

from app.seed import seed_database

BACKEND_DIR = Path(__file__).resolve().parent.parent


def apply_database_migrations() -> None:
    alembic_config = AlembicConfig(str(BACKEND_DIR / "alembic.ini"))
    alembic_config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    command.upgrade(alembic_config, "head")


def bootstrap_runtime_environment(app: Flask) -> None:
    demo_user_password = app.config.get("DEMO_USER_PASSWORD")

    with app.app_context():
        app.logger.info("Applying database migrations before server start")
        apply_database_migrations()

        app.logger.info("Seeding initial data")
        seed_database(demo_user_password=demo_user_password)
