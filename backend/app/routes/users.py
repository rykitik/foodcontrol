from __future__ import annotations

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.auth import login_required
from app.models import User, db
from app.serializers import serialize_user
from app.utils.audit import log_action

users_bp = Blueprint("users", __name__)


def normalize_username(value: str | None) -> str:
    return (value or "").strip().lower()


@users_bp.get("")
@login_required(roles=["head_social", "accountant", "admin"])
def list_users(current_user):
    users = User.query.order_by(User.full_name.asc()).all()
    return jsonify({"data": [serialize_user(user) for user in users]})


@users_bp.post("")
@login_required(roles=["admin", "head_social"])
def create_user(current_user):
    payload = request.get_json(silent=True) or {}
    username = normalize_username(payload.get("username"))
    password = payload.get("password") or ""
    full_name = (payload.get("full_name") or "").strip()
    role = payload.get("role")

    missing_fields = []
    if not username:
        missing_fields.append("username")
    if not password:
        missing_fields.append("password")
    if not full_name:
        missing_fields.append("full_name")
    if not role:
        missing_fields.append("role")
    if missing_fields:
        return jsonify({"error": f"Не заполнены поля: {', '.join(missing_fields)}"}), 400

    if User.query.filter(func.lower(User.username) == username).first():
        return jsonify({"error": "Пользователь с таким логином уже существует"}), 409

    building_id = payload.get("building_id")
    if current_user.role == "head_social" and role == "admin":
        return jsonify({"error": "Недостаточно прав для создания администратора"}), 403

    user = User(
        username=username,
        full_name=full_name,
        email=(payload.get("email") or "").strip() or None,
        phone=(payload.get("phone") or "").strip() or None,
        role=role,
        building_id=int(building_id) if building_id not in (None, "", "null") else None,
        is_active=payload.get("is_active", True),
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    log_action(current_user, "create_user", "user", user.id, {"role": user.role, "building_id": user.building_id})
    return jsonify({"data": serialize_user(user), "message": "Пользователь создан"}), 201


@users_bp.patch("/<user_id>")
@login_required(roles=["admin", "head_social"])
def update_user(current_user, user_id):
    user = User.query.filter_by(id=user_id).first_or_404()
    payload = request.get_json(silent=True) or {}

    if current_user.role == "head_social" and user.role == "admin":
        return jsonify({"error": "Недостаточно прав для изменения администратора"}), 403

    if "username" in payload:
        next_username = normalize_username(payload.get("username"))
        if not next_username:
            return jsonify({"error": "Логин не может быть пустым"}), 400
        duplicate = User.query.filter(func.lower(User.username) == next_username, User.id != user.id).first()
        if duplicate:
            return jsonify({"error": "Пользователь с таким логином уже существует"}), 409
        user.username = next_username

    if "full_name" in payload and payload["full_name"]:
        user.full_name = payload["full_name"].strip()
    if "email" in payload:
        user.email = (payload.get("email") or "").strip() or None
    if "phone" in payload:
        user.phone = (payload.get("phone") or "").strip() or None
    if "building_id" in payload:
        building_id = payload.get("building_id")
        user.building_id = int(building_id) if building_id not in (None, "", "null") else None
    if "is_active" in payload:
        user.is_active = bool(payload["is_active"])

    db.session.commit()
    log_action(
        current_user,
        "update_user",
        "user",
        user.id,
        {"username": user.username, "is_active": user.is_active, "building_id": user.building_id},
    )
    return jsonify({"data": serialize_user(user), "message": "Пользователь обновлен"})

