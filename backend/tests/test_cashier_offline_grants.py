from __future__ import annotations

from datetime import timedelta

import jwt

from app.models import CashierTerminal, OfflineCashierGrant, db, utc_now
from app.services.cashier_terminals import hash_provisioning_code


def login_response(client, username: str, password: str = "password123"):
    return client.post("/api/auth/login", json={"username": username, "password": password})


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def provision_terminal(client, token: str, payload: dict | None = None):
    return client.post(
        "/api/cashier-terminals/provision",
        headers=auth_headers(token),
        json=payload or {},
    )


def issue_offline_grant(client, token: str, terminal_id: str):
    return client.post(
        "/api/auth/offline-grant/issue",
        headers=auth_headers(token),
        json={"terminal_id": terminal_id},
    )


def test_cashier_can_provision_terminal(client):
    login = login_response(client, "cashier1")
    assert login.status_code == 200
    token = login.get_json()["data"]["token"]

    response = provision_terminal(client, token, {"display_name": "Cashier desk #1"})
    assert response.status_code == 200

    data = response.get_json()["data"]
    assert data["new_terminal"] is True
    assert data["terminal_id"]
    assert data["provisioning_code"]
    assert data["terminal"]["display_name"] == "Cashier desk #1"
    assert data["terminal"]["status"] == "active"

    terminal = CashierTerminal.query.filter_by(id=data["terminal_id"]).first()
    assert terminal is not None
    assert terminal.building_id == 1


def test_non_cashier_cannot_provision_terminal(client):
    login = login_response(client, "admin")
    assert login.status_code == 200
    token = login.get_json()["data"]["token"]

    response = provision_terminal(client, token)
    assert response.status_code == 403


def test_issue_offline_grant_rotates_previous_active_grant(client):
    login = login_response(client, "cashier1")
    assert login.status_code == 200
    token = login.get_json()["data"]["token"]

    provision = provision_terminal(client, token, {"display_name": "Cashier desk #2"})
    assert provision.status_code == 200
    terminal_id = provision.get_json()["data"]["terminal_id"]

    first_issue = issue_offline_grant(client, token, terminal_id)
    assert first_issue.status_code == 200
    first_data = first_issue.get_json()["data"]
    first_token = first_data["grant_token"]

    decoded_first = jwt.decode(
        first_token,
        first_data["public_key"],
        algorithms=[first_data["algorithm"]],
        audience=first_data["audience"],
        issuer=first_data["issuer"],
    )
    assert decoded_first["role"] == "cashier"
    assert decoded_first["terminal_id"] == terminal_id
    assert decoded_first["sub"] == login.get_json()["data"]["user"]["id"]

    second_issue = issue_offline_grant(client, token, terminal_id)
    assert second_issue.status_code == 200
    second_data = second_issue.get_json()["data"]
    assert second_data["grant_id"] != first_data["grant_id"]

    first_record = OfflineCashierGrant.query.filter_by(id=first_data["grant_id"]).first()
    second_record = OfflineCashierGrant.query.filter_by(id=second_data["grant_id"]).first()

    assert first_record is not None
    assert second_record is not None
    assert first_record.revoked_at is not None
    assert second_record.revoked_at is None
    assert second_record.rotated_from_id == first_record.id


def test_issue_offline_grant_rejects_terminal_from_another_building(client):
    login = login_response(client, "cashier1")
    assert login.status_code == 200
    token = login.get_json()["data"]["token"]
    cashier_id = login.get_json()["data"]["user"]["id"]

    foreign_terminal = CashierTerminal(
        building_id=2,
        display_name="Foreign building terminal",
        status="active",
        provisioning_code_hash=hash_provisioning_code("FOREIGN-CODE"),
        provisioning_expires_at=utc_now() + timedelta(hours=1),
        created_by_user_id=cashier_id,
        created_at=utc_now(),
        updated_at=utc_now(),
        last_seen_at=utc_now(),
    )
    db.session.add(foreign_terminal)
    db.session.commit()

    response = issue_offline_grant(client, token, foreign_terminal.id)
    assert response.status_code == 403


def test_non_cashier_cannot_issue_offline_grant(client):
    login = login_response(client, "admin")
    assert login.status_code == 200
    token = login.get_json()["data"]["token"]

    response = issue_offline_grant(client, token, "some-terminal-id")
    assert response.status_code == 403
