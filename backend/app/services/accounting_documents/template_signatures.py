from __future__ import annotations

from openpyxl.worksheet.worksheet import Worksheet

from .template_config import PreparedByBinding


def apply_prepared_by_binding(
    worksheet: Worksheet,
    *,
    prepared_by_short_name: str,
    binding: PreparedByBinding | None,
) -> None:
    if binding is None:
        return

    if binding.mode == "value_cell":
        worksheet[binding.cell] = prepared_by_short_name
        return

    worksheet[binding.cell] = f"{binding.prefix}{prepared_by_short_name}"
