"""Add meal selection request idempotency table.

Revision ID: 20260406_0003
Revises: 20260406_0002
Create Date: 2026-04-06 00:30:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260406_0003"
down_revision = "20260406_0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "meal_selection_requests",
        sa.Column("request_id", sa.String(length=128), nullable=False),
        sa.Column("request_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("ticket_id", sa.String(length=36), nullable=False),
        sa.Column("issue_date", sa.Date(), nullable=False),
        sa.Column("created_by", sa.String(length=36), nullable=False),
        sa.Column("response_status", sa.Integer(), nullable=True),
        sa.Column("response_payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"]),
        sa.PrimaryKeyConstraint("request_id"),
    )
    op.create_index(
        "ix_meal_selection_requests_ticket_id",
        "meal_selection_requests",
        ["ticket_id"],
        unique=False,
    )
    op.create_index(
        "ix_meal_selection_requests_issue_date",
        "meal_selection_requests",
        ["issue_date"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_meal_selection_requests_issue_date", table_name="meal_selection_requests")
    op.drop_index("ix_meal_selection_requests_ticket_id", table_name="meal_selection_requests")
    op.drop_table("meal_selection_requests")
