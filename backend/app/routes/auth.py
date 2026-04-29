from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token
from sqlalchemy import func

from app.auth import login_required
from app.models import User, db, utc_now
from app.serializers import serialize_user
from app.services.auth_sessions import (
    create_auth_session,
    find_auth_session_for_token,
    is_active_auth_session,
    revoke_auth_session,
    rotate_auth_session,
)
from app.services.cashier_terminals import CashierTerminalProvisioningError, resolve_active_terminal_for_grant
from app.services.offline_cashier_grants import issue_offline_cashier_grant
from app.utils.audit import log_action
from app.utils.buildings import building_name

auth_bp = Blueprint("auth", __name__)


def build_auth_success_payload(user: User) -> dict:
    token = create_access_token(
        identity=user.id,
        additional_claims={"role": user.role, "building_id": user.building_id},
    )
    return {"token": token, "user": serialize_user(user)}


def set_refresh_cookie(response, refresh_token: str) -> None:
    response.set_cookie(
        key=current_app.config["AUTH_REFRESH_COOKIE_NAME"],
        value=refresh_token,
        httponly=True,
        secure=current_app.config["AUTH_REFRESH_COOKIE_SECURE"],
        samesite=current_app.config["AUTH_REFRESH_COOKIE_SAMESITE"],
        path=current_app.config["AUTH_REFRESH_COOKIE_PATH"],
        domain=current_app.config.get("AUTH_REFRESH_COOKIE_DOMAIN"),
        max_age=int(current_app.config["JWT_REFRESH_TOKEN_EXPIRES"].total_seconds()),
    )


def clear_refresh_cookie(response) -> None:
    response.delete_cookie(
        key=current_app.config["AUTH_REFRESH_COOKIE_NAME"],
        path=current_app.config["AUTH_REFRESH_COOKIE_PATH"],
        domain=current_app.config.get("AUTH_REFRESH_COOKIE_DOMAIN"),
        secure=current_app.config["AUTH_REFRESH_COOKIE_SECURE"],
        samesite=current_app.config["AUTH_REFRESH_COOKIE_SAMESITE"],
    )


def get_refresh_cookie_value() -> str | None:
    cookie_name = current_app.config["AUTH_REFRESH_COOKIE_NAME"]
    return request.cookies.get(cookie_name)


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Логин и пароль обязательны"}), 400

    normalized_username = username.lower()
    users = (
        User.query.filter(func.lower(User.username) == normalized_username)
        .order_by(User.created_at.asc())
        .limit(2)
        .all()
    )
    if len(users) > 1:
        return jsonify({"error": "Обнаружены дубли логина. Обратитесь к администратору системы."}), 409

    user = users[0] if users else None
    password_valid = False
    if user:
        try:
            password_valid = user.check_password(password)
        except Exception:
            current_app.logger.exception(
                "Auth login failed during password verification for username=%s",
                normalized_username,
            )
            password_valid = False

    if not user or not password_valid:
        return jsonify({"error": "Неверный логин или пароль"}), 401
    if not user.is_active:
        return jsonify({"error": "Пользователь отключен"}), 403

    user.last_login = utc_now()
    _, refresh_token = create_auth_session(user.id)
    db.session.commit()
    try:
        log_action(user, "login", "user", user.id)
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Auth login audit logging failed for user_id=%s", user.id)

    response = jsonify({"data": build_auth_success_payload(user)})
    set_refresh_cookie(response, refresh_token)
    return response


@auth_bp.get("/profile")
@login_required()
def profile(current_user):
    return jsonify({"data": serialize_user(current_user)})


@auth_bp.post("/refresh")
def refresh():
    refresh_cookie = get_refresh_cookie_value()
    session = find_auth_session_for_token(refresh_cookie)
    if session is None or not is_active_auth_session(session):
        response = jsonify({"error": "Сессия истекла. Войдите снова."})
        clear_refresh_cookie(response)
        return response, 401

    user = User.query.filter_by(id=session.user_id).first()
    if user is None or not user.is_active:
        revoke_auth_session(session)
        db.session.commit()
        response = jsonify({"error": "Сессия недействительна. Войдите снова."})
        clear_refresh_cookie(response)
        return response, 401

    _, rotated_refresh_token = rotate_auth_session(session)
    db.session.commit()

    response = jsonify({"data": build_auth_success_payload(user)})
    set_refresh_cookie(response, rotated_refresh_token)
    return response


@auth_bp.post("/logout")
@login_required()
def logout(current_user):
    refresh_cookie = get_refresh_cookie_value()
    session = find_auth_session_for_token(refresh_cookie)
    if session is not None and session.user_id == current_user.id:
        revoke_auth_session(session)

    log_action(current_user, "logout", "user", current_user.id)
    db.session.commit()
    response = jsonify({"message": "Выход выполнен"})
    clear_refresh_cookie(response)
    return response


@auth_bp.post("/offline-grant/issue")
@login_required(roles=["cashier"])
def issue_cashier_offline_grant_route(current_user):
    payload = request.get_json(silent=True) or {}
    terminal_id = payload.get("terminal_id")
    try:
        terminal = resolve_active_terminal_for_grant(current_user, terminal_id)
    except CashierTerminalProvisioningError as exc:
        return jsonify({"error": exc.message}), exc.status_code

    try:
        grant, token, public_key = issue_offline_cashier_grant(current_user, terminal)
    except ValueError as exc:
        current_app.logger.error("Offline grant issue rejected: %s", exc)
        return jsonify({"error": "Offline grant signing configuration is invalid"}), 500

    db.session.commit()
    log_action(
        current_user,
        "issue_cashier_offline_grant",
        "cashier_terminal",
        terminal.id,
        {
            "grant_id": grant.id,
            "grant_jti": grant.jti,
            "expires_at": grant.expires_at.isoformat(),
        },
    )

    return jsonify(
        {
            "data": {
                "grant_token": token,
                "grant_id": grant.id,
                "jti": grant.jti,
                "role": grant.role,
                "terminal_id": terminal.id,
                "terminal_display_name": terminal.display_name,
                "building_id": terminal.building_id,
                "building_name": building_name(terminal.building_id),
                "issued_at": grant.issued_at.isoformat(),
                "expires_at": grant.expires_at.isoformat(),
                "algorithm": current_app.config["OFFLINE_GRANT_ALGORITHM"],
                "key_id": current_app.config["OFFLINE_GRANT_KEY_ID"],
                "issuer": current_app.config["OFFLINE_GRANT_ISSUER"],
                "audience": current_app.config["OFFLINE_GRANT_AUDIENCE"],
                "public_key": public_key,
            }
        }
    )
