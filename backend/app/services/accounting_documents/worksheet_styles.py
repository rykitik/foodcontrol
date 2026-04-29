from __future__ import annotations

from functools import lru_cache
from xml.etree import ElementTree

from openpyxl.styles.colors import COLOR_INDEX


def render_worksheet_cell_style(cell, *, allow_overflow: bool) -> str:
    workbook = cell.parent.parent
    styles = [
        "box-sizing:border-box",
        "line-height:1",
        "font-kerning:none",
        "font-variant-ligatures:none",
    ]

    alignment = cell.alignment
    wrap_text = bool(alignment and alignment.wrap_text)
    if wrap_text:
        styles.append("overflow:hidden")
        styles.append("white-space:pre-wrap")
    else:
        styles.append(f"overflow:{'visible' if allow_overflow else 'hidden'}")
        styles.append("white-space:pre")
        if allow_overflow:
            styles.append("position:relative")
            styles.append("z-index:1")

    if alignment:
        horizontal = {
            "center": "center",
            "right": "right",
            "justify": "justify",
            "distributed": "justify",
            "centerContinuous": "center",
            "fill": "left",
        }.get(alignment.horizontal, "left")
        vertical = {
            "top": "top",
            "bottom": "bottom",
            "center": "middle",
            "justify": "middle",
            "distributed": "middle",
        }.get(alignment.vertical, "middle")
        styles.append(f"text-align:{horizontal}")
        styles.append(f"vertical-align:{vertical}")
        if alignment.textRotation not in {None, 0}:
            styles.append("writing-mode:vertical-rl")
            styles.append("transform:rotate(180deg)")

    font = cell.font
    if font:
        if font.name:
            styles.append(f"font-family:{_css_font_family(font.name)}")
        if font.sz:
            styles.append(f"font-size:{font.sz}pt")
        styles.append(f"font-weight:{700 if font.bold else 400}")
        if font.italic:
            styles.append("font-style:italic")
        if font.underline and font.underline != "none":
            styles.append("text-decoration:underline")
        color = _color_to_css(font.color, workbook)
        if color:
            styles.append(f"color:{color}")

    fill_color = _fill_to_css(cell.fill, workbook)
    if fill_color:
        styles.append(f"background:{fill_color}")

    border = cell.border
    if border:
        styles.append(f"border-top:{_border_to_css(border.top, workbook)}")
        styles.append(f"border-right:{_border_to_css(border.right, workbook)}")
        styles.append(f"border-bottom:{_border_to_css(border.bottom, workbook)}")
        styles.append(f"border-left:{_border_to_css(border.left, workbook)}")

    return ";".join(styles)


def render_worksheet_cell_content_style(cell, *, overflow_direction: str | None) -> str:
    if overflow_direction is None:
        return ""

    alignment = cell.alignment
    horizontal = alignment.horizontal if alignment else None
    styles = [
        "display:block",
        "position:relative",
        "z-index:2",
        "width:max-content",
        "max-width:none",
        "min-width:100%",
        "white-space:inherit",
    ]

    if horizontal in {"center", "centerContinuous"}:
        styles.append("margin-left:auto")
        styles.append("margin-right:auto")
    elif overflow_direction == "left":
        styles.append("margin-left:auto")

    return ";".join(styles)


def _border_to_css(side, workbook) -> str:
    if side is None or side.style is None:
        return "0 solid transparent"

    width = {
        "hair": "0.1mm",
        "thin": "0.2mm",
        "medium": "0.35mm",
        "thick": "0.5mm",
        "double": "0.45mm",
        "dashed": "0.2mm",
        "dotted": "0.2mm",
        "dashDot": "0.2mm",
        "dashDotDot": "0.2mm",
        "mediumDashed": "0.35mm",
        "mediumDashDot": "0.35mm",
        "mediumDashDotDot": "0.35mm",
        "slantDashDot": "0.35mm",
    }.get(side.style, "0.2mm")
    style = {
        "dashed": "dashed",
        "dotted": "dotted",
        "double": "double",
        "dashDot": "dashed",
        "dashDotDot": "dashed",
        "mediumDashed": "dashed",
        "mediumDashDot": "dashed",
        "mediumDashDotDot": "dashed",
        "slantDashDot": "dashed",
    }.get(side.style, "solid")
    color = _color_to_css(side.color, workbook) or "#000000"
    return f"{width} {style} {color}"


def _fill_to_css(fill, workbook) -> str | None:
    if fill is None or fill.fill_type != "solid":
        return None
    return _color_to_css(fill.fgColor, workbook)


def _color_to_css(color, workbook=None) -> str | None:
    if color is None:
        return None

    color_type = getattr(color, "type", None)
    rgb: str | None = None

    if color_type == "rgb":
        rgb = getattr(color, "rgb", None) or getattr(color, "value", None)
    elif color_type == "indexed":
        indexed = getattr(color, "indexed", None)
        if indexed == 64:
            return None
        if isinstance(indexed, int) and 0 <= indexed < len(COLOR_INDEX):
            rgb = COLOR_INDEX[indexed]
    elif color_type == "theme":
        theme_index = getattr(color, "theme", None)
        theme_colors = _workbook_theme_colors(getattr(workbook, "loaded_theme", None))
        if isinstance(theme_index, int) and 0 <= theme_index < len(theme_colors):
            rgb = theme_colors[theme_index]
    elif isinstance(getattr(color, "value", None), str):
        rgb = color.value

    if not rgb or not isinstance(rgb, str):
        return None
    if len(rgb) == 8:
        rgb = rgb[2:]
    if len(rgb) != 6:
        return None
    return f"#{rgb.lower()}"


@lru_cache(maxsize=8)
def _workbook_theme_colors(theme_xml: str | bytes | None) -> tuple[str | None, ...]:
    if not theme_xml:
        return ()

    try:
        root = ElementTree.fromstring(theme_xml)
    except ElementTree.ParseError:
        return ()

    namespace = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
    color_scheme = root.find(".//a:themeElements/a:clrScheme", namespace)
    if color_scheme is None:
        return ()

    colors: list[str | None] = []
    for entry in list(color_scheme):
        srgb_color = entry.find("a:srgbClr", namespace)
        if srgb_color is not None:
            colors.append(srgb_color.attrib.get("val"))
            continue

        system_color = entry.find("a:sysClr", namespace)
        colors.append(system_color.attrib.get("lastClr") if system_color is not None else None)

    return tuple(colors)


def _quote_css(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace("'", "\\'")
    return f"'{escaped}'"


def _css_font_family(font_name: str) -> str:
    normalized = font_name.strip().lower()

    if normalized.endswith(" cyr"):
        base_name = font_name.rsplit(" ", 1)[0]
        generic = "serif" if "times" in normalized else "sans-serif"
        return f"{_quote_css(font_name)}, {_quote_css(base_name)}, {generic}"

    if "times" in normalized:
        return f"{_quote_css(font_name)}, serif"
    if "arial" in normalized:
        return f"{_quote_css(font_name)}, sans-serif"

    return f"{_quote_css(font_name)}, Arial, sans-serif"
