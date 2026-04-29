from __future__ import annotations


def extract_cookie_value(response, cookie_name: str) -> str | None:
    for header in response.headers.getlist("Set-Cookie"):
        if not header.startswith(f"{cookie_name}="):
            continue
        return header.split(";", 1)[0].split("=", 1)[1]
    return None


def login_response(client, username: str, password: str = "password123"):
    return client.post("/api/auth/login", json={"username": username, "password": password})


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_login_issues_refresh_cookie_and_refresh_endpoint_rotates_it(client, app):
    login = login_response(client, "admin")
    assert login.status_code == 200
    token = login.get_json()["data"]["token"]
    cookie_name = app.config["AUTH_REFRESH_COOKIE_NAME"]
    first_refresh_cookie = extract_cookie_value(login, cookie_name)
    assert first_refresh_cookie

    refresh = client.post("/api/auth/refresh")
    assert refresh.status_code == 200
    refreshed_token = refresh.get_json()["data"]["token"]
    second_refresh_cookie = extract_cookie_value(refresh, cookie_name)

    assert refreshed_token
    assert refreshed_token != token
    assert second_refresh_cookie
    assert second_refresh_cookie != first_refresh_cookie


def test_reused_rotated_refresh_cookie_is_rejected(client, app):
    cookie_name = app.config["AUTH_REFRESH_COOKIE_NAME"]
    login = login_response(client, "admin")
    assert login.status_code == 200
    first_refresh_cookie = extract_cookie_value(login, cookie_name)
    assert first_refresh_cookie

    refresh = client.post("/api/auth/refresh")
    assert refresh.status_code == 200

    stale_cookie_client = app.test_client()
    reused = stale_cookie_client.post(
        "/api/auth/refresh",
        headers={"Cookie": f"{cookie_name}={first_refresh_cookie}"},
    )

    assert reused.status_code == 401
    assert "истекла" in reused.get_json()["error"]


def test_logout_revokes_current_refresh_session(client, app):
    cookie_name = app.config["AUTH_REFRESH_COOKIE_NAME"]
    login = login_response(client, "admin")
    assert login.status_code == 200
    access_token = login.get_json()["data"]["token"]
    active_refresh_cookie = extract_cookie_value(login, cookie_name)
    assert active_refresh_cookie

    logout = client.post("/api/auth/logout", headers=auth_headers(access_token))
    assert logout.status_code == 200
    cleared_cookie = extract_cookie_value(logout, cookie_name)
    assert cleared_cookie == ""

    stale_cookie_client = app.test_client()
    refresh_after_logout = stale_cookie_client.post(
        "/api/auth/refresh",
        headers={"Cookie": f"{cookie_name}={active_refresh_cookie}"},
    )
    assert refresh_after_logout.status_code == 401
