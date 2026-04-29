from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.auth import login_required
from app.models import Category
from app.serializers import serialize_category
from app.services.category_management import (
    CategoryMutationError,
    archive_category as archive_category_record,
    create_category as create_category_record,
    update_category as update_category_record,
)

categories_bp = Blueprint("categories", __name__)


def category_mutation_error_response(error: CategoryMutationError):
    return jsonify({"error": error.message}), error.status_code


@categories_bp.get("")
@login_required(roles=["social", "head_social", "cashier", "accountant", "admin"])
def list_categories(current_user):
    include_inactive = request.args.get("include_inactive") == "1"
    categories_query = Category.query
    if not include_inactive:
        categories_query = categories_query.filter(Category.is_active.is_(True))

    categories = categories_query.order_by(Category.id.asc()).all()
    return jsonify({"data": [serialize_category(category) for category in categories]})


@categories_bp.post("")
@login_required(roles=["head_social", "admin"])
def create_category(current_user):
    try:
        category = create_category_record(current_user, request.get_json(silent=True) or {})
    except CategoryMutationError as error:
        return category_mutation_error_response(error)

    return jsonify({"data": serialize_category(category), "message": "Категория создана"}), 201


@categories_bp.patch("/<int:category_id>")
@login_required(roles=["head_social", "admin"])
def update_category(current_user, category_id: int):
    category = Category.query.filter_by(id=category_id).first_or_404()

    try:
        updated = update_category_record(current_user, category, request.get_json(silent=True) or {})
    except CategoryMutationError as error:
        return category_mutation_error_response(error)

    return jsonify({"data": serialize_category(updated), "message": "Категория обновлена"})


@categories_bp.delete("/<int:category_id>")
@login_required(roles=["head_social", "admin"])
def archive_category(current_user, category_id: int):
    category = Category.query.filter_by(id=category_id).first_or_404()

    try:
        result = archive_category_record(current_user, category, request.get_json(silent=True) or {})
    except CategoryMutationError as error:
        return category_mutation_error_response(error)

    return jsonify({"data": result, "message": "Категория удалена"})
