from __future__ import annotations

from datetime import date, datetime, time, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import func, or_

from app.auth import login_required
from app.models import Log, User
from app.serializer_state import serialize_logs

logs_bp = Blueprint("logs", __name__)


def parse_iso_date(value: str | None, field_name: str):
    if not value:
        return None, None

    try:
        return date.fromisoformat(value), None
    except ValueError:
        return None, (jsonify({"error": f"{field_name} должен быть в формате YYYY-MM-DD"}), 400)


def parse_limit(value: str | None):
    if not value:
        return 300, None

    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None, (jsonify({"error": "limit должен быть числом"}), 400)

    if parsed < 1 or parsed > 1000:
        return None, (jsonify({"error": "limit должен быть в диапазоне 1-1000"}), 400)

    return parsed, None


@logs_bp.get("")
@login_required(roles=["admin"])
def list_logs(current_user):
    action = request.args.get("action")
    entity_type = request.args.get("entity_type")
    actor = (request.args.get("actor") or "").strip()
    ip_address = (request.args.get("ip_address") or "").strip()
    date_from, date_from_error = parse_iso_date(request.args.get("date_from"), "date_from")
    if date_from_error:
        return date_from_error
    date_to, date_to_error = parse_iso_date(request.args.get("date_to"), "date_to")
    if date_to_error:
        return date_to_error
    limit, limit_error = parse_limit(request.args.get("limit"))
    if limit_error:
        return limit_error

    query = Log.query.outerjoin(User, User.id == Log.user_id).order_by(Log.created_at.desc())
    if action:
        query = query.filter(Log.action == action)
    if entity_type:
        query = query.filter(Log.entity_type == entity_type)
    if ip_address:
        query = query.filter(Log.ip_address.ilike(f"%{ip_address}%"))
    if date_from:
        query = query.filter(Log.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        query = query.filter(Log.created_at < datetime.combine(date_to + timedelta(days=1), time.min))
    if actor:
        actor_pattern = f"%{actor.lower()}%"
        query = query.filter(
            or_(
                func.lower(User.full_name).like(actor_pattern),
                func.lower(User.username).like(actor_pattern),
            )
        )

    logs = query.limit(limit).all()
    return jsonify({"data": serialize_logs(logs)})
