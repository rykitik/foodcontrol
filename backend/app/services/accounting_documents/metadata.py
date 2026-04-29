from __future__ import annotations

from app.models import Category

FORM_METADATA = {
    "institution": "МЦК - ЧЭМК Минобразования Чувашии",
}

CATEGORY_FORM_LABELS = {
    "low_income": {
        "title": "малоимущие",
        "genitive": "малоимущих",
    },
    "ovz": {
        "title": "ОВЗ",
        "genitive": "ОВЗ",
    },
    "orphan": {
        "title": "сироты",
        "genitive": "сирот",
    },
    "large_family": {
        "title": "многодетные",
        "genitive": "многодетных",
    },
    "disabled": {
        "title": "инвалиды",
        "genitive": "инвалидов",
    },
}

MEAL_TYPE_LABELS = {
    "breakfast": "завтрак",
    "lunch": "обед",
}

MEAL_TYPE_COUNT_LABELS = {
    "breakfast": "Количество завтраков:",
    "lunch": "Количество обедов:",
}

ALL_CATEGORIES_NAME = "Все категории"
ALL_CATEGORIES_TITLE_LABEL = "все категории"
ALL_CATEGORIES_GENITIVE_LABEL = "всех категорий"
ALL_CATEGORIES_COST_CALCULATION_LINE = "студентам всех категорий колледжа"

CALCULATION_CATEGORY_LINES = {
    "low_income": "студентам из малоимущих семей колледжа",
    "ovz": "студентам с ОВЗ колледжа",
    "orphan": "студентам-сиротам колледжа",
    "large_family": "студентам из многодетных семей колледжа",
}


def category_title_label(category: Category) -> str:
    return CATEGORY_FORM_LABELS.get(category.code, {}).get("title", category.name.lower())


def category_genitive_label(category: Category) -> str:
    return CATEGORY_FORM_LABELS.get(category.code, {}).get("genitive", category.name.lower())


def meal_type_label(meal_type: str) -> str:
    return MEAL_TYPE_LABELS[meal_type]


def meal_type_count_label(meal_type: str) -> str:
    return MEAL_TYPE_COUNT_LABELS[meal_type]


def meal_sheet_title(category: Category) -> str:
    return f'Накопительная ведомость по питанию в столовой студентов категории "{category_title_label(category)}"'


def all_categories_meal_sheet_title() -> str:
    return "Накопительная ведомость по питанию в столовой студентов всех категорий"


def cost_statement_title() -> str:
    return "ВЕДОМОСТЬ"


def cost_calculation_title() -> str:
    return "Расчет стоимости предоставленного питания"


def cost_calculation_category_line(category: Category | None) -> str:
    if category is None:
        return ALL_CATEGORIES_COST_CALCULATION_LINE
    return CALCULATION_CATEGORY_LINES.get(category.code, f'студентам категории "{category_title_label(category)}" колледжа')


def meal_sheet_filename(category: Category, meal_type: str, month: int, year: int) -> str:
    return f"табель_{category.code}_{meal_type}_{year}_{month:02d}.xlsx"


def cost_statement_filename(category: Category, month: int, year: int) -> str:
    return f"ведомость_{category.code}_{year}_{month:02d}.xlsx"


def meal_sheet_filename_by_code(category_code: str, meal_type: str, month: int, year: int) -> str:
    return f"табель_{category_code}_{meal_type}_{year}_{month:02d}.xlsx"


def cost_statement_filename_by_code(category_code: str, month: int, year: int) -> str:
    return f"ведомость_{category_code}_{year}_{month:02d}.xlsx"


def cost_calculation_filename_by_code(category_code: str, month: int, year: int) -> str:
    return f"расчет_стоимости_{category_code}_{year}_{month:02d}.xlsx"
