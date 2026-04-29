from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy.orm import raiseload

from app.models import Log, MealRecord, Student, Ticket, User, db
from app.serializer_state import (
    build_log_serializer_state,
    build_meal_record_serializer_state,
    build_student_serializer_state,
    build_ticket_serializer_state,
)
from app.serializers import serialize_log, serialize_meal_record, serialize_student, serialize_ticket
from app.services.ticket_lifecycle import build_ticket
from app.utils.meal_rules import meal_price_for_category


def _create_ticket(student: Student, creator: User) -> Ticket:
    start_date = date.today().replace(day=1)
    end_date = start_date + timedelta(days=27)
    ticket = build_ticket(student, creator.id, start_date, end_date)
    db.session.commit()
    return ticket


def test_serialize_student_avoids_hidden_queries_with_explicit_state(app):
    with app.app_context():
        student = Student.query.filter_by(student_card="100001").first()
        creator = User.query.filter_by(username="social1").first()
        ticket = _create_ticket(student, creator)

        db.session.expire_all()
        detached_student = Student.query.options(raiseload("*")).filter_by(id=student.id).first()
        state = build_student_serializer_state([detached_student])

        payload = serialize_student(detached_student, state=state)

        assert payload["id"] == detached_student.id
        assert payload["active_ticket_id"] == ticket.id
        assert payload["category"]["id"] == detached_student.category_id


def test_serialize_ticket_avoids_hidden_queries_with_explicit_state(app):
    with app.app_context():
        student = Student.query.filter_by(student_card="100001").first()
        creator = User.query.filter_by(username="social1").first()
        ticket = _create_ticket(student, creator)

        db.session.expire_all()
        detached_ticket = Ticket.query.options(raiseload("*")).filter_by(id=ticket.id).first()
        state = build_ticket_serializer_state([detached_ticket], include_student=True)

        payload = serialize_ticket(detached_ticket, include_student=True, state=state)

        assert payload["id"] == detached_ticket.id
        assert payload["student_id"] == student.id
        assert payload["created_by_name"] == creator.full_name
        assert payload["student"]["id"] == student.id


def test_serialize_meal_record_avoids_hidden_queries_with_explicit_state(app):
    with app.app_context():
        student = Student.query.filter_by(student_card="100001").first()
        creator = User.query.filter_by(username="social1").first()
        cashier = User.query.filter_by(username="cashier1").first()
        category = student.category
        meal_type = category.meal_types[0]
        ticket = _create_ticket(student, creator)
        record = MealRecord(
            ticket_id=ticket.id,
            student_id=student.id,
            meal_type=meal_type,
            issue_date=ticket.start_date,
            issue_time=datetime.now().time().replace(microsecond=0),
            issued_by=cashier.id,
            building_id=student.effective_meal_building_id,
            price=Decimal(str(meal_price_for_category(category, meal_type))),
        )
        db.session.add(record)
        db.session.commit()

        db.session.expire_all()
        detached_record = MealRecord.query.options(raiseload("*")).filter_by(id=record.id).first()
        state = build_meal_record_serializer_state([detached_record], include_student=True)

        payload = serialize_meal_record(detached_record, include_student=True, state=state)

        assert payload["id"] == detached_record.id
        assert payload["student_id"] == student.id
        assert payload["issued_by_name"] == cashier.full_name
        assert payload["student"]["id"] == student.id


def test_serialize_log_avoids_hidden_queries_with_explicit_state(app):
    with app.app_context():
        user = User.query.filter_by(username="admin").first()
        entry = Log(
            user_id=user.id,
            action="serializer_cleanup_check",
            entity_type="log",
            entity_id="1",
            details={"ok": True},
            ip_address="127.0.0.1",
            user_agent="pytest",
        )
        db.session.add(entry)
        db.session.commit()

        db.session.expire_all()
        detached_entry = Log.query.options(raiseload("*")).filter_by(id=entry.id).first()
        state = build_log_serializer_state([detached_entry])

        payload = serialize_log(detached_entry, state=state)

        assert payload["id"] == detached_entry.id
        assert payload["user_name"] == user.full_name
        assert payload["action"] == "serializer_cleanup_check"


def test_direct_low_level_serializer_calls_fail_with_safe_api_guidance(app):
    with app.app_context():
        student = Student.query.filter_by(student_card="100001").first()
        creator = User.query.filter_by(username="social1").first()
        cashier = User.query.filter_by(username="cashier1").first()
        admin = User.query.filter_by(username="admin").first()
        ticket = _create_ticket(student, creator)
        meal_type = student.category.meal_types[0]
        record = MealRecord(
            ticket_id=ticket.id,
            student_id=student.id,
            meal_type=meal_type,
            issue_date=ticket.start_date,
            issue_time=datetime.now().time().replace(microsecond=0),
            issued_by=cashier.id,
            building_id=student.effective_meal_building_id,
            price=Decimal(str(meal_price_for_category(student.category, meal_type))),
        )
        entry = Log(
            user_id=admin.id,
            action="serializer_misuse_check",
            entity_type="log",
            entity_id="2",
            details={"ok": True},
            ip_address="127.0.0.1",
            user_agent="pytest",
        )
        db.session.add_all([record, entry])
        db.session.commit()

        with pytest.raises(TypeError, match="serialize_student requires explicit StudentSerializerState"):
            serialize_student(student)
        with pytest.raises(TypeError, match="serialize_student_item\\(\\)"):
            serialize_student(student)

        with pytest.raises(TypeError, match="serialize_ticket requires explicit TicketSerializerState"):
            serialize_ticket(ticket)
        with pytest.raises(TypeError, match="serialize_ticket_item\\(\\)"):
            serialize_ticket(ticket)

        with pytest.raises(TypeError, match="serialize_meal_record requires explicit MealRecordSerializerState"):
            serialize_meal_record(record)
        with pytest.raises(TypeError, match="serialize_meal_record_item\\(\\)"):
            serialize_meal_record(record)

        with pytest.raises(TypeError, match="serialize_log requires explicit LogSerializerState"):
            serialize_log(entry)
        with pytest.raises(TypeError, match="serialize_log_item\\(\\)"):
            serialize_log(entry)
