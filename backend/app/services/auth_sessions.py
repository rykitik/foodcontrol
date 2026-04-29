from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass

from flask import current_app

from app.models import AuthSession, db, generate_uuid, utc_now


@dataclass(frozen=True)
class ParsedRefreshToken:
    session_id: str
    raw_token: str


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def parse_refresh_token(raw_token: str | None) -> ParsedRefreshToken | None:
    if not raw_token:
        return None

    normalized = raw_token.strip()
    if not normalized:
        return None

    session_id, separator, _secret = normalized.partition(".")
    if not separator or not session_id:
        return None

    return ParsedRefreshToken(session_id=session_id, raw_token=normalized)


def build_refresh_cookie_payload(session_id: str) -> str:
    return f"{session_id}.{secrets.token_urlsafe(48)}"


def create_auth_session(user_id: str, *, rotated_from_id: str | None = None) -> tuple[AuthSession, str]:
    session_id = generate_uuid()
    refresh_token = build_refresh_cookie_payload(session_id)
    now = utc_now()
    session = AuthSession(
        id=session_id,
        user_id=user_id,
        refresh_token_hash=hash_refresh_token(refresh_token),
        expires_at=now + current_app.config["JWT_REFRESH_TOKEN_EXPIRES"],
        rotated_from_id=rotated_from_id,
        created_at=now,
        last_used_at=now,
    )
    db.session.add(session)
    return session, refresh_token


def find_auth_session_for_token(raw_token: str | None) -> AuthSession | None:
    parsed = parse_refresh_token(raw_token)
    if parsed is None:
        return None

    session = AuthSession.query.filter_by(id=parsed.session_id).first()
    if session is None:
        return None

    if session.refresh_token_hash != hash_refresh_token(parsed.raw_token):
        return None

    return session


def is_active_auth_session(session: AuthSession, *, now=None) -> bool:
    current_time = now or utc_now()
    return session.revoked_at is None and session.expires_at > current_time


def rotate_auth_session(session: AuthSession) -> tuple[AuthSession, str]:
    now = utc_now()
    session.revoked_at = now
    session.last_used_at = now
    return create_auth_session(session.user_id, rotated_from_id=session.id)


def revoke_auth_session(session: AuthSession) -> None:
    if session.revoked_at is None:
        session.revoked_at = utc_now()
    session.last_used_at = utc_now()
