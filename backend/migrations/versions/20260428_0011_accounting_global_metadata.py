"""Add global accounting document metadata.

Revision ID: 20260428_0011
Revises: 20260424_0010
Create Date: 2026-04-28 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260428_0011"
down_revision = "20260424_0010"
branch_labels = None
depends_on = None


def _table_names() -> set[str]:
    inspector = inspect(op.get_bind())
    return set(inspector.get_table_names())


def _index_names(table_name: str) -> set[str]:
    inspector = inspect(op.get_bind())
    return {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade():
    if "accounting_document_global_metadata" not in _table_names():
        op.create_table(
            "accounting_document_global_metadata",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("settings_key", sa.String(length=64), nullable=False),
            sa.Column("values", sa.JSON(), nullable=False),
            sa.Column("updated_by", sa.String(length=36), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        )

    indexes = _index_names("accounting_document_global_metadata")
    with op.batch_alter_table("accounting_document_global_metadata") as batch_op:
        if "ix_accounting_document_global_metadata_settings_key" not in indexes:
            batch_op.create_index(
                batch_op.f("ix_accounting_document_global_metadata_settings_key"),
                ["settings_key"],
                unique=True,
            )


def downgrade():
    if "accounting_document_global_metadata" in _table_names():
        op.drop_table("accounting_document_global_metadata")
