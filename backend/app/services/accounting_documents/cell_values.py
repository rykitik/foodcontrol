from __future__ import annotations

from datetime import date, datetime
from html import escape


def format_cell_display_value(value, number_format: str | None = None) -> str:
    if value is None:
        return ""

    if isinstance(value, datetime):
        return value.strftime("%d.%m.%Y")

    if isinstance(value, date):
        return value.strftime("%d.%m.%Y")

    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"

    if isinstance(value, int):
        return str(value)

    if isinstance(value, float):
        if number_format and any(token in number_format for token in ("0.00", "0,00", ".00", ",00")):
            return f"{value:.2f}".replace(".", ",")
        if value.is_integer():
            return str(int(value))
        return f"{value}".replace(".", ",")

    return str(value)


def render_cell_value_html(value, number_format: str | None = None) -> str:
    display_value = format_cell_display_value(value, number_format)
    if not display_value:
        return "&nbsp;"

    return escape(display_value).replace("\n", "<br />")
