from __future__ import annotations

from types import SimpleNamespace

from app import create_app
from app.models import Category, db
from app.services.database_sequences import sync_postgresql_integer_pk_sequence


def test_sync_postgresql_integer_pk_sequence_skips_non_postgresql(monkeypatch):
    application = create_app(
        config_overrides={
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
        }
    )

    with application.app_context():
        db.create_all()

        def fail_execute(*_args, **_kwargs):
            raise AssertionError("sequence sync must not execute on sqlite")

        monkeypatch.setattr(db.session, "execute", fail_execute)

        sync_postgresql_integer_pk_sequence(Category)


def test_sync_postgresql_integer_pk_sequence_uses_current_max_primary_key(monkeypatch):
    application = create_app(
        config_overrides={
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
        }
    )

    with application.app_context():
        db.create_all()
        db.session.add_all(
            [
                Category(id=4, name="A", code="a", breakfast=False, lunch=True, dinner=False),
                Category(id=9, name="B", code="b", breakfast=False, lunch=True, dinner=False),
            ]
        )
        db.session.commit()

        recorded_calls: list[dict] = []
        original_execute = db.session.execute

        def tracked_execute(statement, *args, **kwargs):
            rendered = str(statement)
            if "setval" in rendered:
                params = args[0] if args else kwargs
                recorded_calls.append(params)
                return SimpleNamespace()
            return original_execute(statement, *args, **kwargs)

        monkeypatch.setattr(
            db.session,
            "get_bind",
            lambda *args, **kwargs: SimpleNamespace(dialect=SimpleNamespace(name="postgresql")),
        )
        monkeypatch.setattr(db.session, "execute", tracked_execute)

        sync_postgresql_integer_pk_sequence(Category)

        assert recorded_calls == [
            {
                "table_name": "categories",
                "column_name": "id",
                "value": 9,
                "is_called": True,
            }
        ]
