from __future__ import annotations

import os
import secrets
from datetime import timedelta
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


class Config:
    APP_HOST = os.environ.get("APP_HOST", "127.0.0.1")
    APP_PORT = env_int("APP_PORT", 5000)
    SECRET_KEY = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or secrets.token_hex(32)
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", f"sqlite:///{BASE_DIR / 'foodcontrol.db'}")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    TESTING = False
    DEBUG = env_bool("FLASK_DEBUG", False) or env_bool("APP_DEBUG", False)
    DEMO_USER_PASSWORD = os.environ.get("DEMO_USER_PASSWORD")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=env_int("JWT_ACCESS_TOKEN_MINUTES", 15))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=env_int("JWT_REFRESH_TOKEN_DAYS", 30))
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_COOKIE_SECURE = False
    JWT_COOKIE_CSRF_PROTECT = False
    AUTH_REFRESH_COOKIE_NAME = os.environ.get("AUTH_REFRESH_COOKIE_NAME", "foodcontrol_refresh")
    AUTH_REFRESH_COOKIE_PATH = os.environ.get("AUTH_REFRESH_COOKIE_PATH", "/api/auth")
    AUTH_REFRESH_COOKIE_SAMESITE = os.environ.get("AUTH_REFRESH_COOKIE_SAMESITE", "Lax")
    AUTH_REFRESH_COOKIE_SECURE = env_bool("AUTH_REFRESH_COOKIE_SECURE", False)
    AUTH_REFRESH_COOKIE_DOMAIN = os.environ.get("AUTH_REFRESH_COOKIE_DOMAIN")
    OFFLINE_TERMINAL_PROVISIONING_HOURS = env_int("OFFLINE_TERMINAL_PROVISIONING_HOURS", 24 * 30)
    OFFLINE_GRANT_EXPIRES_MINUTES = env_int("OFFLINE_GRANT_EXPIRES_MINUTES", 12 * 60)
    OFFLINE_GRANT_ISSUER = os.environ.get("OFFLINE_GRANT_ISSUER", "foodcontrol")
    OFFLINE_GRANT_AUDIENCE = os.environ.get("OFFLINE_GRANT_AUDIENCE", "cashier-offline")
    OFFLINE_GRANT_ALGORITHM = os.environ.get("OFFLINE_GRANT_ALGORITHM", "RS256")
    OFFLINE_GRANT_KEY_ID = os.environ.get("OFFLINE_GRANT_KEY_ID", "offline-v1")
    OFFLINE_GRANT_PRIVATE_KEY = os.environ.get("OFFLINE_GRANT_PRIVATE_KEY")
    OFFLINE_GRANT_PUBLIC_KEY = os.environ.get("OFFLINE_GRANT_PUBLIC_KEY")
    OFFLINE_GRANT_ALLOW_EPHEMERAL_DEV_KEY = env_bool("OFFLINE_GRANT_ALLOW_EPHEMERAL_DEV_KEY", False)
    LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
    LOG_FILE = str(BASE_DIR / "logs" / "app.log")
    DATA_RETENTION_DAYS = 365 * 5
    PASSWORD_MIN_LENGTH = 8
    SESSION_TIMEOUT = 900
    JSON_AS_ASCII = False
    MEAL_HOLIDAYS = os.environ.get("MEAL_HOLIDAYS", "")
    ACCOUNTING_PDF_ENABLED = env_bool("ACCOUNTING_PDF_ENABLED", False)
    LIBREOFFICE_BIN = os.environ.get("LIBREOFFICE_BIN", "soffice")
    ACCOUNTING_PDF_TIMEOUT_SECONDS = env_int("ACCOUNTING_PDF_TIMEOUT_SECONDS", 30)
    ACCOUNTING_PDF_MAX_AUTO_SCALE = env_int("ACCOUNTING_PDF_MAX_AUTO_SCALE", 125)

    @staticmethod
    def init_app(app) -> None:
        import logging
        from logging.handlers import RotatingFileHandler

        log_path = Path(Config.LOG_FILE)
        log_path.parent.mkdir(parents=True, exist_ok=True)

        handler = RotatingFileHandler(log_path, maxBytes=1_000_000, backupCount=5, encoding="utf-8")
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]")
        )
        app.logger.addHandler(handler)
        app.logger.setLevel(Config.LOG_LEVEL)
