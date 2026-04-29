from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class SheetTemplateConfig:
    title: str
    output_name: str
    visible_range: str
    clear_ranges: tuple[str, ...]
    clear_cells: tuple[str, ...] = ()
    unhide_row_spans: tuple[tuple[int, int], ...] = ()


SHEET_CONFIGS: tuple[SheetTemplateConfig, ...] = (
    SheetTemplateConfig(
        title="\u0432\u0435\u0434\u043e\u043c\u043e\u0441\u0442\u044c \u043c\u0430\u043b\u043e\u0438\u043c\u0443\u0449\u0438\u0445",
        output_name="vedomost-maloimuschie.png",
        visible_range="A1:I89",
        clear_ranges=("A18:G83",),
        unhide_row_spans=((2, 5), (86, 89)),
    ),
    SheetTemplateConfig(
        title="\u0442\u0430\u0431\u0435\u043b\u044c \u043c\u0430\u043b\u043e\u0438\u043c\u0443\u0449\u0438\u0445",
        output_name="tabel-maloimuschie.png",
        visible_range="A7:AP47",
        clear_ranges=("A12:AP43",),
        unhide_row_spans=((46, 47),),
    ),
    SheetTemplateConfig(
        title="\u0432\u0435\u0434\u043e\u043c\u043e\u0441\u0442\u044c \u041e\u0412\u0417",
        output_name="vedomost-ovz.png",
        visible_range="A1:I88",
        clear_ranges=("A18:G82",),
    ),
    SheetTemplateConfig(
        title="\u0442\u0430\u0431\u0435\u043b\u044c \u041e\u0412\u0417 \u0437\u0430\u0432\u0442\u0440\u0430\u043a",
        output_name="tabel-ovz-zavtrak.png",
        visible_range="A7:AR47",
        clear_ranges=("A12:AR43",),
        unhide_row_spans=((46, 47),),
    ),
    SheetTemplateConfig(
        title="\u0442\u0430\u0431\u0435\u043b\u044c \u041e\u0412\u0417 \u043e\u0431\u0435\u0434",
        output_name="tabel-ovz-obed.png",
        visible_range="A7:AO47",
        clear_ranges=("A12:AO43",),
        unhide_row_spans=((46, 47),),
    ),
    SheetTemplateConfig(
        title="\u0432\u0435\u0434\u043e\u043c\u043e\u0441\u0442\u044c \u0441\u0438\u0440\u043e\u0442",
        output_name="vedomost-sirot.png",
        visible_range="A1:I53",
        clear_ranges=("A18:G47",),
        unhide_row_spans=((2, 5), (50, 53)),
    ),
    SheetTemplateConfig(
        title="\u0442\u0430\u0431\u0435\u043b\u044c \u0441\u0438\u0440\u043e\u0442",
        output_name="tabel-sirot.png",
        visible_range="A1:AQ40",
        clear_ranges=("A6:AQ36",),
        unhide_row_spans=((40, 40),),
    ),
    SheetTemplateConfig(
        title="\u0432\u0435\u0434\u043e\u043c\u043e\u0441\u0442\u044c \u043c\u043d\u043e\u0433",
        output_name="vedomost-mnogodetnye.png",
        visible_range="A1:I90",
        clear_ranges=("A18:G84",),
        unhide_row_spans=((2, 5), (87, 90)),
    ),
    SheetTemplateConfig(
        title="\u0442\u0430\u0431\u0435\u043b\u044c \u043c\u043d\u043e\u0433 \u0437\u0430\u0432\u0442\u0440\u0430\u043a",
        output_name="tabel-mnogodetnye-zavtrak.png",
        visible_range="A7:AU51",
        clear_ranges=("A12:AU47",),
        unhide_row_spans=((50, 51),),
    ),
    SheetTemplateConfig(
        title="\u0442\u0430\u0431\u0435\u043b\u044c \u043c\u043d\u043e\u0433 \u043e\u0431\u0435\u0434",
        output_name="tabel-mnogodetnye-obed.png",
        visible_range="A7:AQ36",
        clear_ranges=("A12:AQ32",),
        unhide_row_spans=((35, 36),),
    ),
    SheetTemplateConfig(
        title="\u0432\u0435\u0434\u043e\u043c\u043e\u0441\u0442\u044c \u0441\u0443\u0445.\u043f\u0430\u0435\u043a",
        output_name="vedomost-suhpaek.png",
        visible_range="A1:I88",
        clear_ranges=("A18:G81",),
        clear_cells=("B88",),
        unhide_row_spans=((2, 5),),
    ),
)
