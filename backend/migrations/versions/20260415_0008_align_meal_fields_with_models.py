"""Align schema with meal-related model fields.

Revision ID: 20260415_0008
Revises: 20260414_0007
Create Date: 2026-04-15 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260415_0008"
down_revision = "20260414_0007"
branch_labels = None
depends_on = None


def _column_names(table_name: str) -> set[str]:
    inspector = inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


def _index_names(table_name: str) -> set[str]:
    inspector = inspect(op.get_bind())
    return {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade():
    category_columns = _column_names("categories")
    with op.batch_alter_table("categories") as batch_op:
        if "breakfast_price" not in category_columns:
            batch_op.add_column(sa.Column("breakfast_price", sa.Numeric(10, 2), nullable=True))
        if "lunch_price" not in category_columns:
            batch_op.add_column(sa.Column("lunch_price", sa.Numeric(10, 2), nullable=True))

    student_columns = _column_names("students")
    student_indexes = _index_names("students")
    with op.batch_alter_table("students") as batch_op:
        if "meal_building_id" not in student_columns:
            batch_op.add_column(sa.Column("meal_building_id", sa.Integer(), nullable=True))
        if "allow_all_meal_buildings" not in student_columns:
            batch_op.add_column(
                sa.Column(
                    "allow_all_meal_buildings",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.false(),
                )
            )
        if "ix_students_meal_building_id" not in student_indexes:
            batch_op.create_index(batch_op.f("ix_students_meal_building_id"), ["meal_building_id"], unique=False)


def downgrade():
    student_columns = _column_names("students")
    student_indexes = _index_names("students")
    with op.batch_alter_table("students") as batch_op:
        if "ix_students_meal_building_id" in student_indexes:
            batch_op.drop_index(batch_op.f("ix_students_meal_building_id"))
        if "allow_all_meal_buildings" in student_columns:
            batch_op.drop_column("allow_all_meal_buildings")
        if "meal_building_id" in student_columns:
            batch_op.drop_column("meal_building_id")

    category_columns = _column_names("categories")
    with op.batch_alter_table("categories") as batch_op:
        if "lunch_price" in category_columns:
            batch_op.drop_column("lunch_price")
        if "breakfast_price" in category_columns:
            batch_op.drop_column("breakfast_price")
