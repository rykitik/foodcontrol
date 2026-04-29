from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from flask import current_app

from app.models import CashierTerminal, db, utc_now


class CashierTerminalProvisioningError(Exception):
    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def hash_provisioning_code(raw_code: str) -> str:
    return hashlib.sha256(raw_code.encode("utf-8")).hexdigest()


def normalize_provisioning_code(raw_code: str | None) -> str | None:
    normalized = (raw_code or "").strip().upper()
    return normalized or None


def generate_provisioning_code() -> str:
    return secrets.token_hex(8).upper()


def normalize_display_name(raw_name: str | None) -> str:
    normalized = (raw_name or "").strip()
    return normalized[:120] if normalized else "Cashier terminal"


def _ensure_cashier_building_scope(user, terminal: CashierTerminal) -> None:
    if user.building_id is not None and terminal.building_id != user.building_id:
        raise CashierTerminalProvisioningError("Terminal is assigned to another building", 403)


def provision_cashier_terminal(
    user,
    *,
    terminal_id: str | None,
    provisioning_code: str | None,
    display_name: str | None,
) -> tuple[CashierTerminal, str | None, bool]:
    now = utc_now()
    resolved_display_name = normalize_display_name(display_name)
    resolved_provisioning_code = normalize_provisioning_code(provisioning_code)

    if user.role != "cashier":
        raise CashierTerminalProvisioningError("Offline provisioning is available for cashier role only", 403)

    if user.building_id is None:
        raise CashierTerminalProvisioningError("Cashier building binding is required", 400)

    if terminal_id:
        terminal = CashierTerminal.query.filter_by(id=terminal_id).first()
        if terminal is None:
            raise CashierTerminalProvisioningError("Terminal not found", 404)
        if terminal.status != "active":
            raise CashierTerminalProvisioningError("Terminal is disabled", 409)

        _ensure_cashier_building_scope(user, terminal)
        terminal.last_seen_at = now
        if resolved_display_name:
            terminal.display_name = resolved_display_name
        return terminal, None, False

    if resolved_provisioning_code:
        terminal = CashierTerminal.query.filter_by(
            provisioning_code_hash=hash_provisioning_code(resolved_provisioning_code)
        ).first()
        if terminal is None:
            raise CashierTerminalProvisioningError("Invalid provisioning code", 404)
        if terminal.status != "active":
            raise CashierTerminalProvisioningError("Terminal is disabled", 409)
        if terminal.provisioning_expires_at <= now:
            raise CashierTerminalProvisioningError("Provisioning code has expired", 410)

        _ensure_cashier_building_scope(user, terminal)
        terminal.last_seen_at = now
        if resolved_display_name:
            terminal.display_name = resolved_display_name
        return terminal, None, False

    provisioning_value = generate_provisioning_code()
    terminal = CashierTerminal(
        building_id=user.building_id,
        display_name=resolved_display_name,
        status="active",
        provisioning_code_hash=hash_provisioning_code(provisioning_value),
        provisioning_expires_at=now + timedelta(hours=current_app.config["OFFLINE_TERMINAL_PROVISIONING_HOURS"]),
        created_by_user_id=user.id,
        created_at=now,
        updated_at=now,
        last_seen_at=now,
    )
    db.session.add(terminal)
    return terminal, provisioning_value, True


def resolve_active_terminal_for_grant(user, terminal_id: str | None) -> CashierTerminal:
    resolved_terminal_id = (terminal_id or "").strip()
    if not resolved_terminal_id:
        raise CashierTerminalProvisioningError("terminal_id is required", 400)

    terminal = CashierTerminal.query.filter_by(id=resolved_terminal_id).first()
    if terminal is None:
        raise CashierTerminalProvisioningError("Terminal not found", 404)
    if terminal.status != "active":
        raise CashierTerminalProvisioningError("Terminal is disabled", 409)
    if user.building_id is not None and terminal.building_id != user.building_id:
        raise CashierTerminalProvisioningError("Terminal is assigned to another building", 403)

    terminal.last_seen_at = utc_now()
    return terminal
