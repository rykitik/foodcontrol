"""Create holiday calendar table.

Revision ID: 20260410_0005
Revises: 20260408_0004
Create Date: 2026-04-10 19:15:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260410_0005"
down_revision = "20260408_0004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "holiday_calendar",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("holiday_date", sa.Date(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("holiday_date"),
    )
    op.create_index(op.f("ix_holiday_calendar_holiday_date"), "holiday_calendar", ["holiday_date"], unique=True)


def downgrade():
    op.drop_index(op.f("ix_holiday_calendar_holiday_date"), table_name="holiday_calendar")
    op.drop_table("holiday_calendar")
