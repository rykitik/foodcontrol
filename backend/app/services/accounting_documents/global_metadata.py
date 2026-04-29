from __future__ import annotations

from app.models import AccountingDocumentGlobalMetadata, db


DEFAULT_ACCOUNTING_GLOBAL_METADATA_KEY = "default"

GLOBAL_ACCOUNTING_DOCUMENT_METADATA_KEYS = frozenset(
    {
        "institution",
        "division",
        "targetArticle",
        "expenseType",
        "measurementUnit",
        "fundingSource",
        "okpoCode",
        "kspCode",
        "fkrCode",
        "kcsrCode",
        "kvrCode",
        "okeiCode",
    }
)


def is_global_accounting_document_metadata_key(key: str) -> bool:
    return key in GLOBAL_ACCOUNTING_DOCUMENT_METADATA_KEYS


def filter_accounting_document_global_metadata_values(values: dict[str, str] | None) -> dict[str, str]:
    return {
        key: value
        for key, value in _normalize_metadata_values(values).items()
        if is_global_accounting_document_metadata_key(key)
    }


def filter_accounting_document_scoped_metadata_values(values: dict[str, str] | None) -> dict[str, str]:
    return {
        key: value
        for key, value in _normalize_metadata_values(values).items()
        if not is_global_accounting_document_metadata_key(key)
    }


def load_accounting_document_global_metadata_values() -> dict[str, str]:
    row = _load_settings_row()
    if row is None or not isinstance(row.values, dict):
        return {}

    return filter_accounting_document_global_metadata_values(row.values)


def save_accounting_document_global_metadata_values(
    values: dict[str, str],
    *,
    updated_by_user_id: str,
) -> dict[str, str]:
    normalized_values = filter_accounting_document_global_metadata_values(values)
    if not normalized_values:
        return load_accounting_document_global_metadata_values()

    row = _load_settings_row()
    if row is None:
        row = AccountingDocumentGlobalMetadata(
            settings_key=DEFAULT_ACCOUNTING_GLOBAL_METADATA_KEY,
            values={},
            updated_by=updated_by_user_id,
        )

    next_values = load_accounting_document_global_metadata_values()
    next_values.update(normalized_values)
    row.values = next_values
    row.updated_by = updated_by_user_id
    db.session.add(row)
    db.session.commit()
    return next_values


def reset_accounting_document_global_metadata_values(keys: list[str] | None = None) -> dict[str, str]:
    row = _load_settings_row()
    if row is None:
        return {}

    if not keys:
        db.session.delete(row)
        db.session.commit()
        return {}

    reset_keys = {key for key in keys if is_global_accounting_document_metadata_key(key)}
    if not reset_keys:
        return load_accounting_document_global_metadata_values()

    next_values = {
        key: value
        for key, value in load_accounting_document_global_metadata_values().items()
        if key not in reset_keys
    }
    if next_values:
        row.values = next_values
        db.session.add(row)
    else:
        db.session.delete(row)
    db.session.commit()
    return next_values


def _load_settings_row() -> AccountingDocumentGlobalMetadata | None:
    return AccountingDocumentGlobalMetadata.query.filter_by(
        settings_key=DEFAULT_ACCOUNTING_GLOBAL_METADATA_KEY,
    ).one_or_none()


def _normalize_metadata_values(values: dict[str, str] | None) -> dict[str, str]:
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
