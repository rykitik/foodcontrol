from __future__ import annotations

from flask import Blueprint

tickets_bp = Blueprint("tickets", __name__)

from app.routes.tickets import documents as _documents  # noqa: E402,F401
from app.routes.tickets import lifecycle as _lifecycle  # noqa: E402,F401

__all__ = ["tickets_bp"]
