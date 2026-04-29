"""Add category archiving flag.

Revision ID: 20260424_0010
Revises: 20260422_0009
Create Date: 2026-04-24 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260424_0010"
down_revision = "20260422_0009"
branch_labels = None
depends_on = None


def _column_names(table_name: str) -> set[str]:
    inspector = inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade():
    category_columns = _column_names("categories")
    if "is_active" in category_columns:
        return

    with op.batch_alter_table("categories") as batch_op:
        batch_op.add_column(
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true())
        )


def downgrade():
    category_columns = _column_names("categories")
    if "is_active" not in category_columns:
        return

    with op.batch_alter_table("categories") as batch_op:
        batch_op.drop_column("is_active")
