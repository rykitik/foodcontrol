from __future__ import annotations

import click
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate

from app.config import Config
from app.models import bcrypt, db
from app.routes import register_blueprints
from app.seed import seed_database
from app.services.offline_cashier_grant_signing import validate_offline_grant_signing_config

jwt = JWTManager()
migrate = Migrate()


def run_explicit_bootstrap(
    app: Flask,
    *,
    include_demo_users: bool = False,
    demo_user_password: str | None = None,
) -> None:
    with app.app_context():
        db.create_all()
        seed_database(
            include_demo_users=include_demo_users,
            demo_user_password=demo_user_password,
        )


def create_app(config_object: type[Config] | None = None, config_overrides: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_object or Config)
    if config_overrides:
        app.config.update(config_overrides)
    Config.init_app(app)
    validate_offline_grant_signing_config(app.config)

    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=False)

    register_blueprints(app)

    @app.get("/api/health")
    def healthcheck():
        return jsonify({"status": "ok"})

    @app.cli.command("seed")
    @click.option("--with-demo-users", is_flag=True, help="Also create demo users with an explicit password.")
    @click.option("--demo-user-password", help="Password for demo users when --with-demo-users is used.")
    def seed_command(with_demo_users: bool, demo_user_password: str | None):
        with app.app_context():
            seed_database(
                include_demo_users=with_demo_users,
                demo_user_password=demo_user_password,
            )
            print("Seed data created")

    @app.cli.command("bootstrap-dev")
    @click.option(
        "--legacy",
        is_flag=True,
        help="Use legacy bootstrap for a disposable dev database. This bypasses Alembic and is not an upgrade path.",
    )
    @click.option("--with-demo-users", is_flag=True, help="Also create demo users with an explicit password.")
    @click.option("--demo-user-password", help="Password for demo users when --with-demo-users is used.")
    def bootstrap_dev_command(legacy: bool, with_demo_users: bool, demo_user_password: str | None):
        if not legacy:
            raise click.ClickException(
                "bootstrap-dev requires --legacy because it bypasses Alembic and is only supported for disposable dev databases."
            )
        run_explicit_bootstrap(
            app,
            include_demo_users=with_demo_users,
            demo_user_password=demo_user_password,
        )
        print("Legacy development bootstrap completed")

    return app
