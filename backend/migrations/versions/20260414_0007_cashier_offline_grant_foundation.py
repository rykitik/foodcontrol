"""Add cashier terminal registry and offline cashier grants foundation.

Revision ID: 20260414_0007
Revises: 20260413_0006
Create Date: 2026-04-14 18:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260414_0007"
down_revision = "20260413_0006"
branch_labels = None
depends_on = None


cashier_terminal_status = postgresql.ENUM(
    "active",
    "disabled",
    name="cashier_terminal_status",
    create_type=False,
)
offline_grant_roles = postgresql.ENUM(
    "cashier",
    name="offline_grant_roles",
    create_type=False,
)


def upgrade():
    bind = op.get_bind()
    cashier_terminal_status.create(bind, checkfirst=True)
    offline_grant_roles.create(bind, checkfirst=True)

    op.create_table(
        "cashier_terminals",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("building_id", sa.Integer(), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("status", cashier_terminal_status, nullable=False),
        sa.Column("provisioning_code_hash", sa.String(length=64), nullable=False),
        sa.Column("provisioning_expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cashier_terminals_building_id", "cashier_terminals", ["building_id"], unique=False)
    op.create_index(
        "ix_cashier_terminals_provisioning_code_hash",
        "cashier_terminals",
        ["provisioning_code_hash"],
        unique=True,
    )

    op.create_table(
        "offline_cashier_grants",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("jti", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("terminal_id", sa.String(length=36), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("role", offline_grant_roles, nullable=False),
        sa.Column("issued_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("rotated_from_id", sa.String(length=36), nullable=True),
        sa.ForeignKeyConstraint(["rotated_from_id"], ["offline_cashier_grants.id"]),
        sa.ForeignKeyConstraint(["terminal_id"], ["cashier_terminals.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_offline_cashier_grants_jti", "offline_cashier_grants", ["jti"], unique=True)
    op.create_index("ix_offline_cashier_grants_user_id", "offline_cashier_grants", ["user_id"], unique=False)
    op.create_index("ix_offline_cashier_grants_terminal_id", "offline_cashier_grants", ["terminal_id"], unique=False)
    op.create_index("ix_offline_cashier_grants_expires_at", "offline_cashier_grants", ["expires_at"], unique=False)


def downgrade():
    op.drop_index("ix_offline_cashier_grants_expires_at", table_name="offline_cashier_grants")
    op.drop_index("ix_offline_cashier_grants_terminal_id", table_name="offline_cashier_grants")
    op.drop_index("ix_offline_cashier_grants_user_id", table_name="offline_cashier_grants")
    op.drop_index("ix_offline_cashier_grants_jti", table_name="offline_cashier_grants")
    op.drop_table("offline_cashier_grants")

    op.drop_index("ix_cashier_terminals_provisioning_code_hash", table_name="cashier_terminals")
    op.drop_index("ix_cashier_terminals_building_id", table_name="cashier_terminals")
    op.drop_table("cashier_terminals")

    bind = op.get_bind()
    offline_grant_roles.drop(bind, checkfirst=True)
    cashier_terminal_status.drop(bind, checkfirst=True)
