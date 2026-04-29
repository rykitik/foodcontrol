"""Initial schema.

Revision ID: 20260319_0001
Revises:
Create Date: 2026-03-19 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260319_0001"
down_revision = None
branch_labels = None
depends_on = None

USER_ROLE_VALUES = ("social", "head_social", "cashier", "accountant", "admin")
TICKET_STATUS_VALUES = ("active", "used", "expired", "cancelled")
MEAL_TYPE_VALUES = ("breakfast", "lunch", "dinner")
REPORT_TYPE_VALUES = ("meal_sheet", "cost_statement", "summary")


def _enum_type(name: str, values: tuple[str, ...]) -> sa.Enum:
    return sa.Enum(*values, name=name).with_variant(
        postgresql.ENUM(*values, name=name, create_type=False),
        "postgresql",
    )


def _create_postgresql_enum(bind, name: str, values: tuple[str, ...]) -> None:
    if bind.dialect.name != "postgresql":
        return

    postgresql.ENUM(*values, name=name).create(bind, checkfirst=True)


def _drop_postgresql_enum(bind, name: str, values: tuple[str, ...]) -> None:
    if bind.dialect.name != "postgresql":
        return

    postgresql.ENUM(*values, name=name).drop(bind, checkfirst=True)


user_roles = _enum_type("user_roles", USER_ROLE_VALUES)
ticket_status = _enum_type("ticket_status", TICKET_STATUS_VALUES)
meal_types = _enum_type("meal_types", MEAL_TYPE_VALUES)
report_types = _enum_type("report_types", REPORT_TYPE_VALUES)


def upgrade():
    bind = op.get_bind()
    _create_postgresql_enum(bind, "user_roles", USER_ROLE_VALUES)
    _create_postgresql_enum(bind, "ticket_status", TICKET_STATUS_VALUES)
    _create_postgresql_enum(bind, "meal_types", MEAL_TYPE_VALUES)
    _create_postgresql_enum(bind, "report_types", REPORT_TYPE_VALUES)

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.Column("breakfast", sa.Boolean(), nullable=False),
        sa.Column("lunch", sa.Boolean(), nullable=False),
        sa.Column("dinner", sa.Boolean(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(length=7), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("username", sa.String(length=80), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=120), nullable=True),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("role", user_roles, nullable=False),
        sa.Column("building_id", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_login", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)
    op.create_table(
        "logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=True),
        sa.Column("entity_id", sa.String(length=100), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_logs_created_at"), "logs", ["created_at"], unique=False)
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
    op.create_table(
        "students",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("student_card", sa.String(length=50), nullable=False),
        sa.Column("group_name", sa.String(length=50), nullable=False),
        sa.Column("building_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_card"),
    )
    op.create_index(op.f("ix_students_building_id"), "students", ["building_id"], unique=False)
    op.create_index(op.f("ix_students_full_name"), "students", ["full_name"], unique=False)
    op.create_index(op.f("ix_students_group_name"), "students", ["group_name"], unique=False)
    op.create_index(op.f("ix_students_student_card"), "students", ["student_card"], unique=True)
    op.create_table(
        "tickets",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("student_id", sa.String(length=36), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("status", ticket_status, nullable=False),
        sa.Column("qr_code", sa.Text(), nullable=False),
        sa.Column("created_by", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tickets_student_id"), "tickets", ["student_id"], unique=False)
    op.create_table(
        "meal_records",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("ticket_id", sa.String(length=36), nullable=False),
        sa.Column("student_id", sa.String(length=36), nullable=False),
        sa.Column("meal_type", meal_types, nullable=False),
        sa.Column("issue_date", sa.Date(), nullable=False),
        sa.Column("issue_time", sa.Time(), nullable=False),
        sa.Column("issued_by", sa.String(length=36), nullable=False),
        sa.Column("building_id", sa.Integer(), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["issued_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ticket_id", "issue_date", "meal_type", name="unique_meal_per_day"),
    )
    op.create_index(op.f("ix_meal_records_building_id"), "meal_records", ["building_id"], unique=False)
    op.create_index(op.f("ix_meal_records_issue_date"), "meal_records", ["issue_date"], unique=False)
    op.create_index(op.f("ix_meal_records_student_id"), "meal_records", ["student_id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_meal_records_student_id"), table_name="meal_records")
    op.drop_index(op.f("ix_meal_records_issue_date"), table_name="meal_records")
    op.drop_index(op.f("ix_meal_records_building_id"), table_name="meal_records")
    op.drop_table("meal_records")
    op.drop_index(op.f("ix_tickets_student_id"), table_name="tickets")
    op.drop_table("tickets")
    op.drop_index(op.f("ix_students_student_card"), table_name="students")
    op.drop_index(op.f("ix_students_group_name"), table_name="students")
    op.drop_index(op.f("ix_students_full_name"), table_name="students")
    op.drop_index(op.f("ix_students_building_id"), table_name="students")
    op.drop_table("students")
    op.drop_table("reports")
    op.drop_index(op.f("ix_logs_created_at"), table_name="logs")
    op.drop_table("logs")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_table("users")
    op.drop_table("categories")

    bind = op.get_bind()
    _drop_postgresql_enum(bind, "report_types", REPORT_TYPE_VALUES)
    _drop_postgresql_enum(bind, "meal_types", MEAL_TYPE_VALUES)
    _drop_postgresql_enum(bind, "ticket_status", TICKET_STATUS_VALUES)
    _drop_postgresql_enum(bind, "user_roles", USER_ROLE_VALUES)
