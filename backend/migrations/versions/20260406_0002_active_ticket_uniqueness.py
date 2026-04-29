"""Enforce active ticket uniqueness per student and period.

Revision ID: 20260406_0002
Revises: 20260319_0001
Create Date: 2026-04-06 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260406_0002"
down_revision = "20260319_0001"
branch_labels = None
depends_on = None


def _assert_no_duplicate_active_tickets() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT student_id, year, month, COUNT(*) AS cnt
            FROM tickets
            WHERE status = 'active'
            GROUP BY student_id, year, month
            HAVING COUNT(*) > 1
            """
        )
    ).fetchall()
    if rows:
        preview = [dict(row._mapping) for row in rows[:10]]
        raise RuntimeError(
            f"Duplicate active tickets exist; cleanup is required before adding uniqueness constraint: {preview}"
        )


def upgrade():
    _assert_no_duplicate_active_tickets()

    bind = op.get_bind()
    dialect = bind.dialect.name
    index_kwargs: dict[str, object] = {}

    if dialect == "postgresql":
        index_kwargs["postgresql_where"] = sa.text("status = 'active'")
    elif dialect == "sqlite":
        index_kwargs["sqlite_where"] = sa.text("status = 'active'")
    else:
        raise RuntimeError(f"Unsupported dialect for active ticket uniqueness migration: {dialect}")

    op.create_index(
        "uq_tickets_active_student_period",
        "tickets",
        ["student_id", "month", "year"],
        unique=True,
        **index_kwargs,
    )


def downgrade():
    op.drop_index("uq_tickets_active_student_period", table_name="tickets")
