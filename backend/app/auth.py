from __future__ import annotations

from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models import User


def get_current_user():
    user_id = get_jwt_identity()
    if not user_id:
        return None
    return User.query.filter_by(id=user_id).first()


def login_required(roles=None):
    def decorator(function):
        @wraps(function)
        @jwt_required()
        def decorated(*args, **kwargs):
            user = get_current_user()
            if not user or not user.is_active:
                return jsonify({"error": "Пользователь не активен"}), 403

            if roles and user.role not in roles:
                return jsonify({"error": "Недостаточно прав"}), 403

            return function(user, *args, **kwargs)

        return decorated

    return decorator


def ensure_building_access(user, building_id: int | None):
    if building_id is None:
        return None

    if user.role in {"social", "cashier"} and user.building_id != building_id:
        return jsonify({"error": "Доступ к корпусу запрещен"}), 403

    return None
