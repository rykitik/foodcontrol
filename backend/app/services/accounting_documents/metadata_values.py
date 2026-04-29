from __future__ import annotations

from decimal import Decimal, InvalidOperation


def normalize_metadata_text_value(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def normalize_decimal_metadata_value(value, *, field_label: str) -> str:
    number = _parse_decimal(value, field_label=field_label)
    return f"{number:.2f}".replace(".", ",")


def parse_decimal_metadata_value(value, *, field_label: str) -> float:
    return float(_parse_decimal(value, field_label=field_label))


def _parse_decimal(value, *, field_label: str) -> Decimal:
    text = normalize_metadata_text_value(value)
    if not text:
        raise ValueError(f"{field_label} должно быть числом")

    normalized = (
        text.lower()
        .replace("\u00a0", "")
        .replace(" ", "")
        .replace("руб.", "")
        .replace("руб", "")
        .replace("р.", "")
        .replace("р", "")
        .replace("₽", "")
        .replace(",", ".")
    )

    try:
        number = Decimal(normalized)
    except InvalidOperation as exc:
        raise ValueError(f"{field_label} должно быть числом") from exc

    if number <= 0:
        raise ValueError(f"{field_label} должно быть больше нуля")
    return number
