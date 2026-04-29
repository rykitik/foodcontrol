from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Iterable, Literal

from app.models import Ticket

SCAN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
SCAN_CODE_TOKEN_LENGTH = 10
SCAN_CODE_SEPARATOR = "-"
PRINT_PAYLOAD_SEPARATOR = "|"
PRINT_PAYLOAD_MARKER = "-P"

MealType = Literal["breakfast", "lunch"]

MEAL_HINT_SUFFIX = {
    ("breakfast",): "B",
    ("lunch",): "L",
    ("breakfast", "lunch"): "BL",
}

SUFFIX_MEAL_HINT = {
    "B": ("breakfast",),
    "L": ("lunch",),
    "BL": ("breakfast", "lunch"),
}


@dataclass(frozen=True)
class ParsedTicketCode:
    base_code: str
    meal_hint: tuple[MealType, ...] | None


def normalize_ticket_code(value: str | None) -> str:
    return (value or "").strip()


def strip_print_payload(value: str) -> str:
    normalized = normalize_ticket_code(value).split(PRINT_PAYLOAD_SEPARATOR, 1)[0]
    marker_index = normalized.upper().find(PRINT_PAYLOAD_MARKER)
    return normalized[:marker_index] if marker_index != -1 else normalized


def generate_ticket_scan_code() -> str:
    token = "".join(secrets.choice(SCAN_CODE_ALPHABET) for _ in range(SCAN_CODE_TOKEN_LENGTH))
    return f"TK{token}"


def ensure_ticket_scan_code(ticket: Ticket) -> str:
    normalized = normalize_ticket_code(ticket.qr_code)
    if normalized:
        ticket.qr_code = normalized
        return normalized

    for _ in range(20):
        candidate = generate_ticket_scan_code()
        if Ticket.query.filter_by(qr_code=candidate).first() is None:
            ticket.qr_code = candidate
            return candidate

    fallback = f"TK{ticket.id.replace('-', '').upper()[:12]}"
    ticket.qr_code = fallback
    return fallback


def normalize_meal_hint(meals: Iterable[str] | None) -> tuple[MealType, ...]:
    if meals is None:
        return tuple()

    ordered: list[MealType] = []
    for meal_type in ("breakfast", "lunch"):
        if any(str(raw).strip().lower() == meal_type for raw in meals):
            ordered.append(meal_type)
    return tuple(ordered)


def build_ticket_meal_code(base_code: str, meals: Iterable[str] | None) -> str:
    normalized_base = normalize_ticket_code(base_code)
    if not normalized_base:
        return ""

    meal_hint = normalize_meal_hint(meals)
    suffix = MEAL_HINT_SUFFIX.get(meal_hint)
    if not suffix:
        return normalized_base

    return f"{normalized_base}{SCAN_CODE_SEPARATOR}{suffix}"


def parse_ticket_code(value: str | None) -> ParsedTicketCode | None:
    normalized = strip_print_payload(value or "")
    if not normalized:
        return None

    uppercase_value = normalized.upper()
    for suffix, meal_hint in SUFFIX_MEAL_HINT.items():
        marker = f"{SCAN_CODE_SEPARATOR}{suffix}"
        if not uppercase_value.endswith(marker):
            continue

        base_code = normalize_ticket_code(normalized[: -len(marker)])
        if not base_code:
            continue
        return ParsedTicketCode(base_code=base_code, meal_hint=meal_hint)

    return ParsedTicketCode(base_code=normalized, meal_hint=None)
