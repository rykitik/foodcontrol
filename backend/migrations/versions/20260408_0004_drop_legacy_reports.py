"""Drop legacy reports table.

Revision ID: 20260408_0004
Revises: 20260406_0003
Create Date: 2026-04-08 17:30:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260408_0004"
down_revision = "20260406_0003"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    op.drop_table("reports")
    sa.Enum("meal_sheet", "cost_statement", "summary", name="report_types").drop(bind, checkfirst=True)


def downgrade():
    report_types = sa.Enum("meal_sheet", "cost_statement", "summary", name="report_types")
    bind = op.get_bind()
    report_types.create(bind, checkfirst=True)
    op.create_table(
        "reports",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", report_types, nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=True),
        sa.Column("created_by", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("parameters", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
