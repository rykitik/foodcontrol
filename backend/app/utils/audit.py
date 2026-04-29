from __future__ import annotations

from flask import request

from app.models import Log, db


def log_action(user, action: str, entity_type: str | None = None, entity_id: str | None = None, details=None):
    entry = Log(
        user_id=user.id if user else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details or {},
        ip_address=request.headers.get("X-Forwarded-For", request.remote_addr),
        user_agent=request.headers.get("User-Agent"),
    )
    db.session.add(entry)
    db.session.commit()
