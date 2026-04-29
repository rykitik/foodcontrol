from __future__ import annotations

from typing import Any

from sqlalchemy import Integer, func, select, text

from app.models import db


def sync_postgresql_integer_pk_sequence(model: type[Any]) -> None:
    bind = db.session.get_bind(clause=model.__table__)
    if bind is None or bind.dialect.name != "postgresql":
        return

    primary_key_columns = list(model.__table__.primary_key.columns)
    if len(primary_key_columns) != 1:
        return

    primary_key_column = primary_key_columns[0]
    if not isinstance(primary_key_column.type, Integer):
        return

    max_primary_key = db.session.execute(select(func.max(primary_key_column))).scalar_one()
    next_value = int(max_primary_key) if max_primary_key is not None else 1

    db.session.execute(
        text(
            """
            SELECT setval(
                pg_get_serial_sequence(:table_name, :column_name),
                :value,
                :is_called
            )
            """
        ),
        {
            "table_name": model.__table__.fullname,
            "column_name": primary_key_column.name,
            "value": next_value,
            "is_called": max_primary_key is not None,
        },
    )
