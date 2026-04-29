from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True, slots=True)
class AccountingDocumentContext:
    prepared_by_full_name: str
    prepared_by_short_name: str
    generated_at: date


def build_accounting_document_context(*, full_name: str, generated_at: date) -> AccountingDocumentContext:
    normalized_full_name = _normalize_full_name(full_name)
    if not normalized_full_name:
        raise ValueError("Для формирования бухгалтерского документа требуется ФИО текущего пользователя")

    return AccountingDocumentContext(
        prepared_by_full_name=normalized_full_name,
        prepared_by_short_name=format_person_short_name(normalized_full_name),
        generated_at=generated_at,
    )


def format_person_short_name(full_name: str) -> str:
    normalized_full_name = _normalize_full_name(full_name)
    parts = normalized_full_name.split()
    if len(parts) < 2:
        return normalized_full_name

    surname = parts[0]
    initials = " ".join(f"{part[0]}." for part in parts[1:] if part)
    return f"{surname} {initials}".strip()


def _normalize_full_name(value: str) -> str:
    return " ".join((value or "").split())
