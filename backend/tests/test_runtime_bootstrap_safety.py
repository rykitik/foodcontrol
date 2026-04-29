from __future__ import annotations

import pytest

import app as app_module
from app import create_app
from app.seed import seed_database


def test_create_app_does_not_run_bootstrap_side_effects_by_default(monkeypatch):
    calls: list[str] = []

    def fail_create_all(*_args, **_kwargs):
        calls.append("create_all")
        raise AssertionError("create_all must not run during ordinary runtime startup")

    def fail_seed(*_args, **_kwargs):
        calls.append("seed_database")
        raise AssertionError("seed_database must not run during ordinary runtime startup")

    monkeypatch.setattr(app_module.db, "create_all", fail_create_all)
    monkeypatch.setattr(app_module, "seed_database", fail_seed)

    application = create_app(
        config_overrides={
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "OFFLINE_GRANT_ALLOW_EPHEMERAL_DEV_KEY": True,
        }
    )

    assert application is not None
    assert calls == []


def test_create_app_ignores_legacy_auto_init_overrides(monkeypatch):
    calls: list[str] = []

    def fail_create_all(*_args, **_kwargs):
        calls.append("create_all")
        raise AssertionError("create_all must not run from hidden startup bootstrap")

    def fail_seed(*_args, **_kwargs):
        calls.append("seed_database")
        raise AssertionError("seed_database must not run from hidden startup bootstrap")

    monkeypatch.setattr(app_module.db, "create_all", fail_create_all)
    monkeypatch.setattr(app_module, "seed_database", fail_seed)

    application = create_app(
        config_overrides={
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "AUTO_INIT_DB": True,
            "AUTO_SEED_DB": True,
            "OFFLINE_GRANT_ALLOW_EPHEMERAL_DEV_KEY": True,
        }
    )

    assert application is not None
    assert calls == []


def test_bootstrap_dev_requires_legacy_flag():
    application = create_app(
        config_overrides={
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
        }
    )

    runner = application.test_cli_runner()
    result = runner.invoke(args=["bootstrap-dev"])

    assert result.exit_code != 0
    assert "--legacy" in result.output


def test_bootstrap_dev_runs_only_with_legacy_flag(monkeypatch):
    calls: list[tuple[bool, str | None]] = []

    def track_explicit_bootstrap(_app, *, include_demo_users: bool = False, demo_user_password: str | None = None):
        calls.append((include_demo_users, demo_user_password))

    monkeypatch.setattr(app_module, "run_explicit_bootstrap", track_explicit_bootstrap)

    application = create_app(
        config_overrides={
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
        }
    )

    runner = application.test_cli_runner()
    result = runner.invoke(
        args=["bootstrap-dev", "--legacy", "--with-demo-users", "--demo-user-password", "dev-pass"]
    )

    assert result.exit_code == 0
    assert calls == [(True, "dev-pass")]


def test_seed_database_requires_explicit_demo_password_outside_testing():
    application = create_app(
        config_overrides={
            "TESTING": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "OFFLINE_GRANT_ALLOW_EPHEMERAL_DEV_KEY": True,
        }
    )

    with application.app_context():
        with pytest.raises(ValueError, match="Explicit demo user password is required"):
            seed_database(include_demo_users=True)
