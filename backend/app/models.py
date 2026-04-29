from __future__ import annotations

from datetime import UTC, date, datetime
import uuid

from flask_bcrypt import Bcrypt
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Index, text
from sqlalchemy.orm import validates

from app.utils.meal_rules import meal_prices_for_category, meal_types_for_category

db = SQLAlchemy()
bcrypt = Bcrypt()


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(120))
    phone = db.Column(db.String(20))
    role = db.Column(
        db.Enum("social", "head_social", "cashier", "accountant", "admin", name="user_roles"),
        nullable=False,
    )
    building_id = db.Column(db.Integer, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)
    last_login = db.Column(db.DateTime)

    created_tickets = db.relationship("Ticket", backref="creator", lazy=True, foreign_keys="Ticket.created_by")
    meal_records = db.relationship("MealRecord", backref="cashier", lazy=True, foreign_keys="MealRecord.issued_by")
    auth_sessions = db.relationship("AuthSession", backref="user", lazy=True, foreign_keys="AuthSession.user_id")
    provisioned_cashier_terminals = db.relationship(
        "CashierTerminal",
        backref="provisioner",
        lazy=True,
        foreign_keys="CashierTerminal.created_by_user_id",
    )
    offline_cashier_grants = db.relationship(
        "OfflineCashierGrant",
        backref="user",
        lazy=True,
        foreign_keys="OfflineCashierGrant.user_id",
    )

    @validates("username")
    def normalize_username(self, _key: str, value: str) -> str:
        normalized = (value or "").strip().lower()
        if not normalized:
            raise ValueError("Username must not be empty")
        return normalized

    def set_password(self, password: str) -> None:
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, password)


class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    code = db.Column(db.String(20), unique=True, nullable=False)
    breakfast = db.Column(db.Boolean, default=False, nullable=False)
    lunch = db.Column(db.Boolean, default=False, nullable=False)
    dinner = db.Column(db.Boolean, default=False, nullable=False)
    breakfast_price = db.Column(db.Numeric(10, 2))
    lunch_price = db.Column(db.Numeric(10, 2))
    description = db.Column(db.Text)
    color = db.Column(db.String(7))
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    @property
    def meal_types(self) -> list[str]:
        return meal_types_for_category(self)

    @property
    def meal_prices(self) -> dict[str, float]:
        return meal_prices_for_category(self)


class Student(db.Model):
    __tablename__ = "students"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    full_name = db.Column(db.String(255), nullable=False, index=True)
    student_card = db.Column(db.String(50), unique=True, nullable=False, index=True)
    group_name = db.Column(db.String(50), nullable=False, index=True)
    building_id = db.Column(db.Integer, nullable=False, index=True)
    meal_building_id = db.Column(db.Integer, nullable=True, index=True)
    allow_all_meal_buildings = db.Column(db.Boolean, default=False, nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    category = db.relationship("Category", backref="students")
    tickets = db.relationship("Ticket", backref="student", lazy=True)
    meal_records = db.relationship("MealRecord", backref="student", lazy=True)

    @property
    def effective_meal_building_id(self) -> int:
        return self.meal_building_id or self.building_id


class Ticket(db.Model):
    __tablename__ = "tickets"
    __table_args__ = (
        Index(
            "uq_tickets_active_student_period",
            "student_id",
            "month",
            "year",
            unique=True,
            sqlite_where=text("status = 'active'"),
            postgresql_where=text("status = 'active'"),
        ),
    )

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    student_id = db.Column(db.String(36), db.ForeignKey("students.id"), nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False)
    month = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    status = db.Column(
        db.Enum("active", "used", "expired", "cancelled", name="ticket_status"),
        default="active",
        nullable=False,
    )
    qr_code = db.Column(db.Text, nullable=False)
    created_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)

    category = db.relationship("Category")
    meal_records = db.relationship("MealRecord", backref="ticket", lazy=True)


class MealRecord(db.Model):
    __tablename__ = "meal_records"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    ticket_id = db.Column(db.String(36), db.ForeignKey("tickets.id"), nullable=False, index=True)
    student_id = db.Column(db.String(36), db.ForeignKey("students.id"), nullable=False, index=True)
    meal_type = db.Column(
        db.Enum("breakfast", "lunch", name="meal_types"),
        nullable=False,
    )
    issue_date = db.Column(db.Date, nullable=False, default=date.today, index=True)
    issue_time = db.Column(db.Time, nullable=False, default=lambda: utc_now().time())
    issued_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    building_id = db.Column(db.Integer, nullable=False, index=True)
    price = db.Column(db.Numeric(10, 2))
    notes = db.Column(db.Text)

    __table_args__ = (
        db.UniqueConstraint("ticket_id", "issue_date", "meal_type", name="unique_meal_per_day"),
    )


class MealSelectionRequest(db.Model):
    __tablename__ = "meal_selection_requests"

    request_id = db.Column(db.String(128), primary_key=True)
    request_fingerprint = db.Column(db.String(64), nullable=False)
    ticket_id = db.Column(db.String(36), db.ForeignKey("tickets.id"), nullable=False, index=True)
    issue_date = db.Column(db.Date, nullable=False, index=True)
    created_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    response_status = db.Column(db.Integer)
    response_payload = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)
    completed_at = db.Column(db.DateTime)


class AuthSession(db.Model):
    __tablename__ = "auth_sessions"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    refresh_token_hash = db.Column(db.String(64), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False, index=True)
    revoked_at = db.Column(db.DateTime)
    rotated_from_id = db.Column(db.String(36), db.ForeignKey("auth_sessions.id"))
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)
    last_used_at = db.Column(db.DateTime, default=utc_now, nullable=False)


class CashierTerminal(db.Model):
    __tablename__ = "cashier_terminals"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    building_id = db.Column(db.Integer, nullable=False, index=True)
    display_name = db.Column(db.String(120), nullable=False)
    status = db.Column(
        db.Enum("active", "disabled", name="cashier_terminal_status"),
        default="active",
        nullable=False,
    )
    provisioning_code_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    provisioning_expires_at = db.Column(db.DateTime, nullable=False)
    created_by_user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    last_seen_at = db.Column(db.DateTime, default=utc_now, nullable=False)


class OfflineCashierGrant(db.Model):
    __tablename__ = "offline_cashier_grants"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    jti = db.Column(db.String(36), nullable=False, unique=True, index=True)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    terminal_id = db.Column(db.String(36), db.ForeignKey("cashier_terminals.id"), nullable=False, index=True)
    token_hash = db.Column(db.String(64), nullable=False)
    role = db.Column(db.Enum("cashier", name="offline_grant_roles"), nullable=False, default="cashier")
    issued_at = db.Column(db.DateTime, default=utc_now, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False, index=True)
    revoked_at = db.Column(db.DateTime)
    rotated_from_id = db.Column(db.String(36), db.ForeignKey("offline_cashier_grants.id"))
    terminal = db.relationship("CashierTerminal", backref="offline_grants", lazy=True)


class HolidayCalendar(db.Model):
    __tablename__ = "holiday_calendar"

    id = db.Column(db.Integer, primary_key=True)
    holiday_date = db.Column(db.Date, unique=True, nullable=False, index=True)
    title = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_by = db.Column(db.String(36), db.ForeignKey("users.id"))
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    creator = db.relationship("User", lazy=True)


class Log(db.Model):
    __tablename__ = "logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"))
    action = db.Column(db.String(100), nullable=False)
    entity_type = db.Column(db.String(50))
    entity_id = db.Column(db.String(100))
    details = db.Column(db.JSON)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False, index=True)

    user = db.relationship("User", lazy=True)


class AccountingDocumentMetadataOverride(db.Model):
    __tablename__ = "accounting_document_metadata_overrides"

    id = db.Column(db.Integer, primary_key=True)
    scope = db.Column(db.String(160), nullable=False, unique=True, index=True)
    document_kind = db.Column(db.String(32), nullable=False, index=True)
    category_code = db.Column(db.String(32), nullable=False, index=True)
    month = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    meal_type = db.Column(db.String(16), index=True)
    values = db.Column(db.JSON, nullable=False, default=dict)
    updated_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    updater = db.relationship("User", lazy=True)


class AccountingDocumentGlobalMetadata(db.Model):
    __tablename__ = "accounting_document_global_metadata"

    id = db.Column(db.Integer, primary_key=True)
    settings_key = db.Column(db.String(64), nullable=False, unique=True, index=True)
    values = db.Column(db.JSON, nullable=False, default=dict)
    updated_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    updater = db.relationship("User", lazy=True)


