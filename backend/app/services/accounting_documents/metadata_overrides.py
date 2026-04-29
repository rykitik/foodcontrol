from __future__ import annotations

from dataclasses import dataclass

from app.models import AccountingDocumentMetadataOverride, db


@dataclass(frozen=True, slots=True)
class AccountingDocumentMetadataOverrideScope:
    document_kind: str
    category_code: str
    month: int
    year: int
    meal_type: str | None = None

    @property
    def key(self) -> str:
        meal_type = self.meal_type or "none"
        return f"{self.document_kind}:{self.category_code}:{meal_type}:{self.year:04d}-{self.month:02d}"


def build_accounting_document_metadata_override_scope(payload: dict) -> AccountingDocumentMetadataOverrideScope:
    return AccountingDocumentMetadataOverrideScope(
        document_kind=str(payload["document_type"]),
        category_code=str(payload["category_code"]),
        month=int(payload["month"]),
        year=int(payload["year"]),
        meal_type=str(payload["meal_type"]) if payload.get("meal_type") else None,
    )


def load_accounting_document_metadata_override_values(payload: dict) -> dict[str, str]:
    scope = build_accounting_document_metadata_override_scope(payload)
    row = AccountingDocumentMetadataOverride.query.filter_by(scope=scope.key).one_or_none()
    if row is None or not isinstance(row.values, dict):
        return {}

    return _normalize_override_values(row.values)


def save_accounting_document_metadata_override_values(
    payload: dict,
    values: dict[str, str],
    *,
    updated_by_user_id: str,
) -> dict[str, str]:
    scope = build_accounting_document_metadata_override_scope(payload)
    normalized_values = _normalize_override_values(values)
    row = AccountingDocumentMetadataOverride.query.filter_by(scope=scope.key).one_or_none()

    if not normalized_values:
        if row is not None:
            db.session.delete(row)
            db.session.commit()
        return {}

    if row is None:
        row = AccountingDocumentMetadataOverride(
            scope=scope.key,
            document_kind=scope.document_kind,
            category_code=scope.category_code,
            month=scope.month,
            year=scope.year,
            meal_type=scope.meal_type,
            updated_by=updated_by_user_id,
        )

    row.values = normalized_values
    row.updated_by = updated_by_user_id
    db.session.add(row)
    db.session.commit()
    return normalized_values


def reset_accounting_document_metadata_override_values(payload: dict) -> None:
    scope = build_accounting_document_metadata_override_scope(payload)
    row = AccountingDocumentMetadataOverride.query.filter_by(scope=scope.key).one_or_none()
    if row is None:
        return

    db.session.delete(row)
    db.session.commit()


def _normalize_override_values(values: dict[str, str] | None) -> dict[str, str]:
    if not isinstance(values, dict):
        return {}

    normalized: dict[str, str] = {}
    for key, value in values.items():
        if not isinstance(key, str):
            continue
        if value is None:
            normalized[key] = ""
            continue
        if isinstance(value, str):
            normalized[key] = value.strip()
            continue
        normalized[key] = str(value).strip()

    return normalized
