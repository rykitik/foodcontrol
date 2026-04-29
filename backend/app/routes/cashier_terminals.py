from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.auth import login_required
from app.models import CashierTerminal, db
from app.services.cashier_terminals import CashierTerminalProvisioningError, provision_cashier_terminal
from app.utils.audit import log_action
from app.utils.buildings import building_name

cashier_terminals_bp = Blueprint("cashier_terminals", __name__)


def serialize_cashier_terminal(terminal: CashierTerminal) -> dict:
    return {
        "id": terminal.id,
        "building_id": terminal.building_id,
        "building_name": building_name(terminal.building_id),
        "display_name": terminal.display_name,
        "status": terminal.status,
        "provisioning_expires_at": terminal.provisioning_expires_at.isoformat() if terminal.provisioning_expires_at else None,
        "last_seen_at": terminal.last_seen_at.isoformat() if terminal.last_seen_at else None,
        "created_at": terminal.created_at.isoformat() if terminal.created_at else None,
        "updated_at": terminal.updated_at.isoformat() if terminal.updated_at else None,
    }


@cashier_terminals_bp.post("/provision")
@login_required(roles=["cashier"])
def provision_terminal(current_user):
    payload = request.get_json(silent=True) or {}
    terminal_id = payload.get("terminal_id")
    provisioning_code = payload.get("provisioning_code")
    display_name = payload.get("display_name")

    try:
        terminal, issued_code, is_new_terminal = provision_cashier_terminal(
            current_user,
            terminal_id=terminal_id,
            provisioning_code=provisioning_code,
            display_name=display_name,
        )
    except CashierTerminalProvisioningError as exc:
        return jsonify({"error": exc.message}), exc.status_code

    db.session.commit()
    log_action(
        current_user,
        "provision_cashier_terminal",
        "cashier_terminal",
        terminal.id,
        {
            "new_terminal": is_new_terminal,
            "terminal_status": terminal.status,
        },
    )

    return jsonify(
        {
            "data": {
                "terminal": serialize_cashier_terminal(terminal),
                "terminal_id": terminal.id,
                "provisioning_code": issued_code,
                "new_terminal": is_new_terminal,
            }
        }
    )
