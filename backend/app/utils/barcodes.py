from __future__ import annotations

from io import BytesIO

from barcode import Code128
from barcode.writer import SVGWriter


def render_code128_svg(value: str) -> str:
    buffer = BytesIO()
    barcode = Code128(value, writer=SVGWriter())
    barcode.write(
        buffer,
        options={
            "module_width": 0.18,
            "module_height": 14.0,
            "quiet_zone": 1.0,
            "write_text": False,
            "background": "white",
            "foreground": "black",
        },
    )
    svg = buffer.getvalue().decode("utf-8")
    start = svg.find("<svg")
    return svg[start:] if start >= 0 else svg
