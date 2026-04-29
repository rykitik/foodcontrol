from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.auth import login_required
from app.models import Log
from app.serializer_state import serialize_logs

logs_bp = Blueprint("logs", __name__)


@logs_bp.get("")
@login_required(roles=["admin"])
def list_logs(current_user):
    action = request.args.get("action")
    entity_type = request.args.get("entity_type")

    query = Log.query.order_by(Log.created_at.desc())
    if action:
        query = query.filter(Log.action == action)
    if entity_type:
        query = query.filter(Log.entity_type == entity_type)

    logs = query.limit(200).all()
    return jsonify({"data": serialize_logs(logs)})
