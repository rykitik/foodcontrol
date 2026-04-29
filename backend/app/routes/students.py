from __future__ import annotations

from datetime import date

from flask import Blueprint, jsonify, request
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from app.auth import ensure_building_access, login_required
from app.models import Category, MealRecord, Student, Ticket, db
from app.serializers import serialize_category
from app.serializer_state import (
    serialize_meal_records,
    serialize_student_item,
    serialize_students,
    serialize_tickets,
)
from app.services.student_creation import (
    StudentCreationError,
    create_student as create_student_record,
)
from app.services.student_groups import list_student_group_names
from app.utils.audit import log_action
from app.utils.student_access import (
    available_for_cashier_building_expr,
    has_student_management_access,
    visible_to_social_building_expr,
)

students_bp = Blueprint("students", __name__)
DEFAULT_STUDENT_PAGE_SIZE = 25
MAX_STUDENT_PAGE_SIZE = 100
VALID_STUDENT_STATUS_FILTERS = {"all", "active", "inactive"}


def parse_optional_date(value: str | None, field_name: str):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return jsonify({"error": f"Некорректная дата в поле {field_name}, нужен YYYY-MM-DD"}), 400


def build_student_access_error():
    return jsonify({"error": "Доступ к студенту запрещен"}), 403


def build_student_bad_request_error(field_name: str):
    return jsonify({"error": f"Некорректное значение поля {field_name}"}), 400


def build_student_conflict_error():
    return jsonify({"error": "Конфликт данных студента"}), 409


def parse_int_field(value, field_name: str, *, allow_empty: bool = False):
    if value in {None, ""}:
        if allow_empty:
            return None, None
        return None, build_student_bad_request_error(field_name)
    try:
        return int(value), None
    except (TypeError, ValueError):
        return None, build_student_bad_request_error(field_name)


def parse_student_status_filter(raw_value: str | None):
    if raw_value is None:
        return "active", None

    normalized = raw_value.strip().lower()
    if normalized not in VALID_STUDENT_STATUS_FILTERS:
        return None, build_student_bad_request_error("status")

    return normalized, None


def build_student_search_query(
    current_user,
    query_text: str,
    building_id: int | None,
    category_id: int | None,
    status_filter: str,
):
    query = Student.query.join(Category)
    if status_filter == "active":
        query = query.filter(Student.is_active.is_(True))
    elif status_filter == "inactive":
        query = query.filter(Student.is_active.is_(False))

    if query_text:
        like_term = f"%{query_text}%"
        query = query.filter(
            or_(
                Student.full_name.ilike(like_term),
                Student.group_name.ilike(like_term),
                Student.student_card.ilike(like_term),
            )
        )

    if current_user.role == "social":
        query = query.filter(visible_to_social_building_expr(current_user.building_id))
    elif current_user.role == "cashier":
        query = query.filter(available_for_cashier_building_expr(current_user.building_id))
    elif building_id:
        query = query.filter(Student.building_id == building_id)

    if category_id:
        query = query.filter(Category.id == category_id)

    return query


def paginate_students(query, page: int, page_size: int):
    resolved_page = max(page, 1)
    resolved_page_size = min(max(page_size, 1), MAX_STUDENT_PAGE_SIZE)
    total = query.order_by(None).count()
    students = (
        query.order_by(Student.is_active.desc(), Student.full_name.asc(), Student.id.asc())
        .offset((resolved_page - 1) * resolved_page_size)
        .limit(resolved_page_size)
        .all()
    )
    return {
        "items": serialize_students(students),
        "page": resolved_page,
        "page_size": resolved_page_size,
        "total": total,
    }


@students_bp.get("")
@login_required(roles=["social", "head_social", "cashier", "accountant", "admin"])
def list_students(current_user):
    query_text = request.args.get("q", "").strip()
    building_id = request.args.get("building_id", type=int)
    category_id = request.args.get("category_id", type=int)
    status_filter, error = parse_student_status_filter(request.args.get("status"))
    if error:
        return error
    page = request.args.get("page", default=1, type=int) or 1
    page_size = request.args.get("page_size", default=DEFAULT_STUDENT_PAGE_SIZE, type=int) or DEFAULT_STUDENT_PAGE_SIZE

    payload = paginate_students(
        build_student_search_query(current_user, query_text, building_id, category_id, status_filter),
        page,
        page_size,
    )
    return jsonify({"data": payload})


@students_bp.get("/search")
@login_required(roles=["social", "head_social", "cashier", "accountant", "admin"])
def search_students(current_user):
    query_text = request.args.get("q", "").strip()
    building_id = request.args.get("building_id", type=int)
    category_id = request.args.get("category_id", type=int)
    status_filter, error = parse_student_status_filter(request.args.get("status"))
    if error:
        return error

    payload = paginate_students(
        build_student_search_query(current_user, query_text, building_id, category_id, status_filter),
        page=1,
        page_size=50,
    )
    return jsonify({"data": payload["items"]})


@students_bp.get("/meta/groups")
@login_required(roles=["social", "head_social", "admin"])
def list_student_groups(current_user):
    building_id, error = parse_int_field(request.args.get("building_id"), "building_id", allow_empty=True)
    if error:
        return error
    limit, error = parse_int_field(request.args.get("limit"), "limit", allow_empty=True)
    if error:
        return error

    if building_id is not None:
        access_error = ensure_building_access(current_user, building_id)
        if access_error:
            return access_error

    payload = list_student_group_names(
        current_user,
        query_text=request.args.get("q", ""),
        building_id=building_id,
        limit=limit,
    )
    return jsonify({"data": payload})


@students_bp.get("/<student_id>")
@login_required(roles=["social", "head_social", "cashier", "accountant", "admin"])
def get_student(current_user, student_id):
    student = Student.query.filter_by(id=student_id).first_or_404()
    if not has_student_management_access(current_user, student):
        return build_student_access_error()
    return jsonify({"data": serialize_student_item(student)})


@students_bp.post("")
@login_required(roles=["social", "head_social", "admin"])
def create_student(current_user):
    try:
        student = create_student_record(current_user, request.get_json(silent=True) or {})
    except StudentCreationError as error:
        return jsonify({"error": error.message}), error.status_code

    return jsonify({"data": serialize_student_item(student), "message": "Студент создан"}), 201


@students_bp.patch("/<student_id>")
@login_required(roles=["social", "head_social", "admin"])
def update_student(current_user, student_id):
    student = Student.query.filter_by(id=student_id).first_or_404()
    payload = request.get_json(silent=True) or {}

    if not has_student_management_access(current_user, student):
        return build_student_access_error()

    if "building_id" in payload and payload.get("building_id") is not None:
        next_building_id, error = parse_int_field(payload.get("building_id"), "building_id")
        if error:
            return error
        access_error = ensure_building_access(current_user, next_building_id)
        if access_error:
            return access_error
        student.building_id = next_building_id

    if "meal_building_id" in payload:
        next_meal_building_id, error = parse_int_field(payload.get("meal_building_id"), "meal_building_id", allow_empty=True)
        if error:
            return error
        if next_meal_building_id is None:
            student.meal_building_id = None
        else:
            student.meal_building_id = next_meal_building_id

    if "allow_all_meal_buildings" in payload:
        student.allow_all_meal_buildings = bool(payload["allow_all_meal_buildings"])

    if "category_id" in payload:
        category_id, error = parse_int_field(payload.get("category_id"), "category_id")
        if error:
            return error
        category = Category.query.filter_by(id=category_id, is_active=True).first()
        if not category:
            return jsonify({"error": "Категория не найдена"}), 404
        student.category_id = category.id

    if "full_name" in payload and payload["full_name"]:
        student.full_name = payload["full_name"].strip()
    if "student_card" in payload and payload["student_card"]:
        student.student_card = payload["student_card"].strip()
    if "group_name" in payload and payload["group_name"]:
        student.group_name = payload["group_name"].strip()
    if "is_active" in payload:
        student.is_active = bool(payload["is_active"])

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return build_student_conflict_error()
    log_action(
        current_user,
        "update_student",
        "student",
        student.id,
        {
            "building_id": student.building_id,
            "meal_building_id": student.meal_building_id,
            "allow_all_meal_buildings": student.allow_all_meal_buildings,
            "category_id": student.category_id,
            "is_active": student.is_active,
        },
    )
    return jsonify({"data": serialize_student_item(student), "message": "Студент обновлен"})


@students_bp.get("/<student_id>/history")
@login_required(roles=["social", "head_social", "cashier", "accountant", "admin"])
def student_history(current_user, student_id):
    student = Student.query.filter_by(id=student_id).first_or_404()
    if not has_student_management_access(current_user, student):
        return build_student_access_error()

    period_start = parse_optional_date(request.args.get("period_start"), "period_start")
    if isinstance(period_start, tuple):
        return period_start
    period_end = parse_optional_date(request.args.get("period_end"), "period_end")
    if isinstance(period_end, tuple):
        return period_end
    meal_type = request.args.get("meal_type")
    limit = request.args.get("limit", default=100, type=int)

    query = MealRecord.query.filter_by(student_id=student.id)
    if period_start:
        query = query.filter(MealRecord.issue_date >= period_start)
    if period_end:
        query = query.filter(MealRecord.issue_date <= period_end)
    if meal_type:
        query = query.filter(MealRecord.meal_type == meal_type)

    ordered_records = query.order_by(
        MealRecord.issue_date.desc(),
        MealRecord.issue_time.desc(),
    ).limit(max(1, min(limit or 100, 365))).all()

    return jsonify({"data": serialize_meal_records(ordered_records)})


@students_bp.get("/<student_id>/tickets")
@login_required(roles=["social", "head_social", "cashier", "accountant", "admin"])
def student_tickets(current_user, student_id):
    student = Student.query.filter_by(id=student_id).first_or_404()
    if not has_student_management_access(current_user, student):
        return build_student_access_error()

    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)
    status = request.args.get("status")

    query = Ticket.query.filter_by(student_id=student.id)
    if month:
        query = query.filter(Ticket.month == month)
    if year:
        query = query.filter(Ticket.year == year)
    if status:
        query = query.filter(Ticket.status == status)

    tickets = query.order_by(Ticket.created_at.desc()).all()
    return jsonify({"data": serialize_tickets(tickets)})


@students_bp.get("/meta/categories")
@login_required(roles=["social", "head_social", "cashier", "accountant", "admin"])
def list_categories(current_user):
    categories = Category.query.filter(Category.is_active.is_(True)).order_by(Category.id.asc()).all()
    return jsonify({"data": [serialize_category(category) for category in categories]})
