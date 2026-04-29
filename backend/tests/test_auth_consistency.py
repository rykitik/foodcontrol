from __future__ import annotations

from io import BytesIO


def login(client, username: str, password: str = "password123") -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    token = response.get_json()["data"]["token"]
    return {"Authorization": f"Bearer {token}"}


def test_login_is_case_insensitive_for_username(client):
    response = client.post("/api/auth/login", json={"username": "AdMiN", "password": "password123"})

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["user"]["username"] == "admin"


def test_user_creation_blocks_case_only_username_duplicates(client):
    headers = login(client, "headsocial")

    first = client.post(
        "/api/users",
        headers=headers,
        json={
            "username": "CaseUser",
            "password": "password123",
            "full_name": "Case User",
            "role": "accountant",
        },
    )
    assert first.status_code == 201

    duplicate = client.post(
        "/api/users",
        headers=headers,
        json={
            "username": "caseuser",
            "password": "password123",
            "full_name": "Case User 2",
            "role": "accountant",
        },
    )
    assert duplicate.status_code == 409


def test_user_update_blocks_case_only_username_collision(client):
    headers = login(client, "headsocial")

    first = client.post(
        "/api/users",
        headers=headers,
        json={
            "username": "alphauser",
            "password": "password123",
            "full_name": "Alpha User",
            "role": "accountant",
        },
    )
    assert first.status_code == 201
    first_id = first.get_json()["data"]["id"]

    second = client.post(
        "/api/users",
        headers=headers,
        json={
            "username": "betauser",
            "password": "password123",
            "full_name": "Beta User",
            "role": "accountant",
        },
    )
    assert second.status_code == 201
    second_id = second.get_json()["data"]["id"]

    collision = client.patch(
        f"/api/users/{second_id}",
        headers=headers,
        json={"username": "ALPHAUSER"},
    )
    assert collision.status_code == 409

    self_normalize = client.patch(
        f"/api/users/{first_id}",
        headers=headers,
        json={"username": "ALPHAUSER"},
    )
    assert self_normalize.status_code == 200
    assert self_normalize.get_json()["data"]["username"] == "alphauser"


def test_removed_import_endpoints_return_not_found(client):
    headers = login(client, "headsocial")
    csv_payload = "username,password,full_name\nalpha,password123,Alpha User\n".encode("utf-8")

    users_import = client.post(
        "/api/imports/users",
        headers=headers,
        data={"dry_run": "false", "file": (BytesIO(csv_payload), "users.csv")},
        content_type="multipart/form-data",
    )
    tickets_import = client.post(
        "/api/imports/tickets",
        headers=headers,
        data={"dry_run": "false", "file": (BytesIO(csv_payload), "tickets.csv")},
        content_type="multipart/form-data",
    )

    assert users_import.status_code == 404
    assert tickets_import.status_code == 404
