from __future__ import annotations

from datetime import date


def login(client, username: str, password: str = "password123") -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    token = response.get_json()["data"]["token"]
    return {"Authorization": f"Bearer {token}"}


def test_create_holiday_range_creates_missing_dates_and_skips_existing(client):
    headers = login(client, "headsocial")
    existing_date = date(2026, 4, 15)

    existing_response = client.post(
        "/api/holidays",
        headers=headers,
        json={
            "holiday_date": existing_date.isoformat(),
            "title": "Уже заведено",
            "is_active": True,
        },
    )

    assert existing_response.status_code == 201

    response = client.post(
        "/api/holidays/bulk",
        headers=headers,
        json={
            "start_date": "2026-04-14",
            "end_date": "2026-04-16",
            "title": "Каникулы",
            "is_active": True,
        },
    )

    assert response.status_code == 201
    payload = response.get_json()["data"]

    assert payload["created_count"] == 2
    assert payload["skipped_count"] == 1
    assert payload["skipped_dates"] == ["2026-04-15"]
    assert [entry["holiday_date"] for entry in payload["created"]] == ["2026-04-14", "2026-04-16"]

    list_response = client.get(
        "/api/holidays",
        headers=headers,
        query_string={"start_date": "2026-04-14", "end_date": "2026-04-16", "include_inactive": "true"},
    )

    assert list_response.status_code == 200
    dates = [entry["holiday_date"] for entry in list_response.get_json()["data"]]
    assert dates == ["2026-04-14", "2026-04-15", "2026-04-16"]


def test_create_holiday_range_rejects_invalid_date_order(client):
    headers = login(client, "headsocial")

    response = client.post(
        "/api/holidays/bulk",
        headers=headers,
        json={
            "start_date": "2026-04-20",
            "end_date": "2026-04-10",
            "title": "Каникулы",
        },
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "Дата окончания диапазона не может быть раньше даты начала"
