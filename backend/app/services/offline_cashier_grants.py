from __future__ import annotations

import hashlib
from datetime import timedelta
from typing import Any

import jwt
from flask import current_app

from app.models import OfflineCashierGrant, db, generate_uuid, utc_now
from app.services.offline_cashier_grant_signing import resolve_signing_material


def hash_grant_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def revoke_active_offline_grants(user_id: str, terminal_id: str, *, now=None) -> OfflineCashierGrant | None:
    current_time = now or utc_now()
    active = (
        OfflineCashierGrant.query.filter(
            OfflineCashierGrant.user_id == user_id,
            OfflineCashierGrant.terminal_id == terminal_id,
            OfflineCashierGrant.revoked_at.is_(None),
            OfflineCashierGrant.expires_at > current_time,
        )
        .order_by(OfflineCashierGrant.issued_at.desc())
        .all()
    )
    for record in active:
        record.revoked_at = current_time

    return active[0] if active else None


def issue_offline_cashier_grant(user, terminal) -> tuple[OfflineCashierGrant, str, str]:
    algorithm = current_app.config["OFFLINE_GRANT_ALGORITHM"]
    if algorithm != "RS256":
        raise ValueError("OFFLINE_GRANT_ALGORITHM must be RS256 for cashier offline grants")

    now = utc_now()
    expires_at = now + timedelta(minutes=current_app.config["OFFLINE_GRANT_EXPIRES_MINUTES"])
    previous = revoke_active_offline_grants(user.id, terminal.id, now=now)
    jti = generate_uuid()
    issued_ts = int(now.timestamp())
    expires_ts = int(expires_at.timestamp())

    payload: dict[str, Any] = {
        "iss": current_app.config["OFFLINE_GRANT_ISSUER"],
        "aud": current_app.config["OFFLINE_GRANT_AUDIENCE"],
        "sub": user.id,
        "jti": jti,
        "role": "cashier",
        "building_id": user.building_id,
        "terminal_id": terminal.id,
        "iat": issued_ts,
        "nbf": issued_ts,
        "exp": expires_ts,
        "typ": "cashier_offline_grant",
    }
    headers = {"kid": current_app.config["OFFLINE_GRANT_KEY_ID"], "typ": "JWT"}
    private_key, public_key = resolve_signing_material(current_app.config)
    token = jwt.encode(
        payload,
        key=private_key,
        algorithm=algorithm,
        headers=headers,
    )

    grant = OfflineCashierGrant(
        id=generate_uuid(),
        jti=jti,
        user_id=user.id,
        terminal_id=terminal.id,
        token_hash=hash_grant_token(token),
        role="cashier",
        issued_at=now,
        expires_at=expires_at,
        rotated_from_id=previous.id if previous else None,
    )
    db.session.add(grant)
    return grant, token, public_key
