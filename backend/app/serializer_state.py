from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from sqlalchemy import func

from app.models import Category, Log, MealRecord, Student, Ticket, User, db
from app.serializers import (
    serialize_category,
    serialize_log,
    serialize_meal_record,
    serialize_student,
    serialize_ticket,
)


def _unique_ids(values: Iterable[object]) -> list[object]:
    seen: set[object] = set()
    unique: list[object] = []
    for value in values:
        if value is None or value in seen:
            continue
        seen.add(value)
        unique.append(value)
    return unique


def _load_category_payloads(category_ids: Iterable[int]) -> dict[int, dict]:
    ids = _unique_ids(category_ids)
    if not ids:
        return {}
    categories = Category.query.filter(Category.id.in_(ids)).all()
    return {category.id: serialize_category(category) for category in categories}


def _load_students(student_ids: Iterable[str]) -> dict[str, Student]:
    ids = _unique_ids(student_ids)
    if not ids:
        return {}
    students = Student.query.filter(Student.id.in_(ids)).all()
    return {student.id: student for student in students}


def _load_user_names(user_ids: Iterable[str]) -> dict[str, str]:
    ids = _unique_ids(user_ids)
    if not ids:
        return {}
    users = User.query.filter(User.id.in_(ids)).all()
    return {user.id: user.full_name for user in users}


@dataclass(slots=True)
class StudentSerializerState:
    category_payloads_by_category_id: dict[int, dict]
    active_ticket_ids_by_student_id: dict[str, str]


@dataclass(slots=True)
class TicketSerializerState:
    students_by_id: dict[str, Student]
    category_payloads_by_category_id: dict[int, dict]
    creator_names_by_user_id: dict[str, str]
    meal_record_counts_by_ticket_id: dict[str, int]
    active_ticket_counts_by_period: dict[tuple[str, int, int], int]
    student_state: StudentSerializerState | None = None


@dataclass(slots=True)
class MealRecordSerializerState:
    students_by_id: dict[str, Student]
    category_payloads_by_category_id: dict[int, dict]
    cashier_names_by_user_id: dict[str, str]
    student_state: StudentSerializerState | None = None


@dataclass(slots=True)
class LogSerializerState:
    user_names_by_user_id: dict[str, str]


def build_student_serializer_state(
    students: Iterable[Student],
    *,
    include_active_ticket: bool = True,
) -> StudentSerializerState:
    student_list = list(students)
    category_payloads = _load_category_payloads(student.category_id for student in student_list)
    active_ticket_ids: dict[str, str] = {}

    if include_active_ticket:
        student_ids = _unique_ids(student.id for student in student_list)
        if student_ids:
            active_tickets = (
                Ticket.query.filter(
                    Ticket.student_id.in_(student_ids),
                    Ticket.status == "active",
                )
                .order_by(Ticket.student_id.asc(), Ticket.created_at.desc())
                .all()
            )
            for ticket in active_tickets:
                active_ticket_ids.setdefault(ticket.student_id, ticket.id)

    return StudentSerializerState(
        category_payloads_by_category_id=category_payloads,
        active_ticket_ids_by_student_id=active_ticket_ids,
    )


def build_ticket_serializer_state(
    tickets: Iterable[Ticket],
    *,
    include_student: bool = False,
) -> TicketSerializerState:
    ticket_list = list(tickets)
    ticket_ids = _unique_ids(ticket.id for ticket in ticket_list)
    students_by_id = _load_students(ticket.student_id for ticket in ticket_list)
    student_state = build_student_serializer_state(students_by_id.values()) if include_student else None

    if student_state is not None:
        category_payloads = student_state.category_payloads_by_category_id
    else:
        category_payloads = _load_category_payloads(ticket.category_id for ticket in ticket_list)

    meal_record_counts: dict[str, int] = {}
    if ticket_ids:
        meal_record_rows = (
            db.session.query(
                MealRecord.ticket_id,
                func.count(MealRecord.id),
            )
            .filter(MealRecord.ticket_id.in_(ticket_ids))
            .group_by(MealRecord.ticket_id)
            .all()
        )
        meal_record_counts = {ticket_id: int(count) for ticket_id, count in meal_record_rows}

    active_ticket_counts_by_period: dict[tuple[str, int, int], int] = {}
    student_ids = _unique_ids(ticket.student_id for ticket in ticket_list)
    if student_ids:
        active_ticket_rows = (
            db.session.query(
                Ticket.student_id,
                Ticket.month,
                Ticket.year,
                func.count(Ticket.id),
            )
            .filter(
                Ticket.student_id.in_(student_ids),
                Ticket.status == "active",
            )
            .group_by(Ticket.student_id, Ticket.month, Ticket.year)
            .all()
        )
        active_ticket_counts_by_period = {
            (student_id, month, year): int(count)
            for student_id, month, year, count in active_ticket_rows
        }

    return TicketSerializerState(
        students_by_id=students_by_id,
        category_payloads_by_category_id=category_payloads,
        creator_names_by_user_id=_load_user_names(ticket.created_by for ticket in ticket_list),
        meal_record_counts_by_ticket_id=meal_record_counts,
        active_ticket_counts_by_period=active_ticket_counts_by_period,
        student_state=student_state,
    )


def build_meal_record_serializer_state(
    records: Iterable[MealRecord],
    *,
    include_student: bool = False,
) -> MealRecordSerializerState:
    record_list = list(records)
    students_by_id = _load_students(record.student_id for record in record_list)
    student_state = (
        build_student_serializer_state(students_by_id.values(), include_active_ticket=True)
        if include_student
        else None
    )

    if student_state is not None:
        category_payloads = student_state.category_payloads_by_category_id
    else:
        category_payloads = _load_category_payloads(student.category_id for student in students_by_id.values())

    return MealRecordSerializerState(
        students_by_id=students_by_id,
        category_payloads_by_category_id=category_payloads,
        cashier_names_by_user_id=_load_user_names(record.issued_by for record in record_list),
        student_state=student_state,
    )


def build_log_serializer_state(entries: Iterable[Log]) -> LogSerializerState:
    entry_list = list(entries)
    return LogSerializerState(
        user_names_by_user_id=_load_user_names(entry.user_id for entry in entry_list),
    )


def serialize_students(students: Iterable[Student], *, include_active_ticket: bool = True) -> list[dict]:
    student_list = list(students)
    state = build_student_serializer_state(student_list, include_active_ticket=include_active_ticket)
    return [
        serialize_student(student, include_active_ticket=include_active_ticket, state=state)
        for student in student_list
    ]


def serialize_student_item(student: Student, *, include_active_ticket: bool = True) -> dict:
    return serialize_students([student], include_active_ticket=include_active_ticket)[0]


def serialize_tickets(tickets: Iterable[Ticket], *, include_student: bool = False) -> list[dict]:
    ticket_list = list(tickets)
    state = build_ticket_serializer_state(ticket_list, include_student=include_student)
    return [
        serialize_ticket(ticket, include_student=include_student, state=state)
        for ticket in ticket_list
    ]


def serialize_ticket_item(ticket: Ticket, *, include_student: bool = False) -> dict:
    return serialize_tickets([ticket], include_student=include_student)[0]


def serialize_meal_records(records: Iterable[MealRecord], *, include_student: bool = False) -> list[dict]:
    record_list = list(records)
    state = build_meal_record_serializer_state(record_list, include_student=include_student)
    return [
        serialize_meal_record(record, include_student=include_student, state=state)
        for record in record_list
    ]


def serialize_meal_record_item(record: MealRecord, *, include_student: bool = False) -> dict:
    return serialize_meal_records([record], include_student=include_student)[0]


def serialize_logs(entries: Iterable[Log]) -> list[dict]:
    entry_list = list(entries)
    state = build_log_serializer_state(entry_list)
    return [serialize_log(entry, state=state) for entry in entry_list]


def serialize_log_item(entry: Log) -> dict:
    return serialize_logs([entry])[0]
