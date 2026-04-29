"""Add shared accounting document metadata overrides.

Revision ID: 20260422_0009
Revises: 20260415_0008
Create Date: 2026-04-22 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260422_0009"
down_revision = "20260415_0008"
branch_labels = None
depends_on = None


def _table_names() -> set[str]:
    inspector = inspect(op.get_bind())
    return set(inspector.get_table_names())


def _index_names(table_name: str) -> set[str]:
    inspector = inspect(op.get_bind())
    return {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade():
    if "accounting_document_metadata_overrides" not in _table_names():
        op.create_table(
            "accounting_document_metadata_overrides",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("scope", sa.String(length=160), nullable=False),
            sa.Column("document_kind", sa.String(length=32), nullable=False),
            sa.Column("category_code", sa.String(length=32), nullable=False),
            sa.Column("month", sa.Integer(), nullable=False),
            sa.Column("year", sa.Integer(), nullable=False),
            sa.Column("meal_type", sa.String(length=16), nullable=True),
            sa.Column("values", sa.JSON(), nullable=False),
            sa.Column("updated_by", sa.String(length=36), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        )

    indexes = _index_names("accounting_document_metadata_overrides")
    with op.batch_alter_table("accounting_document_metadata_overrides") as batch_op:
        if "ix_accounting_document_metadata_overrides_scope" not in indexes:
            batch_op.create_index(batch_op.f("ix_accounting_document_metadata_overrides_scope"), ["scope"], unique=True)
        if "ix_accounting_document_metadata_overrides_document_kind" not in indexes:
            batch_op.create_index(
                batch_op.f("ix_accounting_document_metadata_overrides_document_kind"),
                ["document_kind"],
                unique=False,
            )
        if "ix_accounting_document_metadata_overrides_category_code" not in indexes:
            batch_op.create_index(
                batch_op.f("ix_accounting_document_metadata_overrides_category_code"),
                ["category_code"],
                unique=False,
            )
        if "ix_accounting_document_metadata_overrides_meal_type" not in indexes:
            batch_op.create_index(
                batch_op.f("ix_accounting_document_metadata_overrides_meal_type"),
                ["meal_type"],
                unique=False,
            )


def downgrade():
    if "accounting_document_metadata_overrides" in _table_names():
        op.drop_table("accounting_document_metadata_overrides")
