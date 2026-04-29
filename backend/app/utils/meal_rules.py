from __future__ import annotations

from datetime import date


CATEGORY_MEAL_RULES = {
    "ovz": {
        "breakfast": True,
        "lunch": True,
        "meal_prices": {"breakfast": 95.0, "lunch": 165.0},
    },
    "orphan": {
        "breakfast": False,
        "lunch": True,
        "meal_prices": {"lunch": 175.0},
    },
    "large_family": {
        "breakfast": True,
        "lunch": True,
        "meal_prices": {"breakfast": 95.0, "lunch": 150.0},
    },
    "disabled": {
        "breakfast": False,
        "lunch": True,
        "meal_prices": {"lunch": 165.0},
    },
    "low_income": {
        "breakfast": False,
        "lunch": True,
        "meal_prices": {"lunch": 150.0},
    },
}

SUPPORTED_MEAL_TYPES = ("breakfast", "lunch")


def configured_meal_prices_for_category(category) -> dict[str, float]:
    code = (getattr(category, "code", "") or "").lower()
    defaults = CATEGORY_MEAL_RULES.get(code, {})
    default_prices = defaults.get("meal_prices", {})

    breakfast_price = getattr(category, "breakfast_price", None)
    lunch_price = getattr(category, "lunch_price", None)

    return {
        "breakfast": float(breakfast_price) if breakfast_price is not None else float(default_prices.get("breakfast", 95.0)),
        "lunch": float(lunch_price) if lunch_price is not None else float(default_prices.get("lunch", 165.0)),
    }


def _fallback_rules(category) -> dict:
    configured_prices = configured_meal_prices_for_category(category)
    return {
        "breakfast": bool(getattr(category, "breakfast", False)),
        "lunch": bool(getattr(category, "lunch", False)),
        "meal_prices": {
            "breakfast": configured_prices["breakfast"] if getattr(category, "breakfast", False) else 0.0,
            "lunch": configured_prices["lunch"] if getattr(category, "lunch", False) else 0.0,
        },
    }


def get_category_rules(category) -> dict:
    code = (getattr(category, "code", "") or "").lower()
    defaults = CATEGORY_MEAL_RULES.get(code, {})
    breakfast_enabled = bool(getattr(category, "breakfast", defaults.get("breakfast", False)))
    lunch_enabled = bool(getattr(category, "lunch", defaults.get("lunch", False)))
    configured_prices = configured_meal_prices_for_category(category)

    return {
        "breakfast": breakfast_enabled,
        "lunch": lunch_enabled,
        "meal_prices": {
            "breakfast": configured_prices["breakfast"] if breakfast_enabled else 0.0,
            "lunch": configured_prices["lunch"] if lunch_enabled else 0.0,
        },
    }


def meal_types_for_category(category) -> list[str]:
    rules = get_category_rules(category)
    return [meal_type for meal_type in SUPPORTED_MEAL_TYPES if rules.get(meal_type)]


def meal_prices_for_category(category) -> dict[str, float]:
    rules = get_category_rules(category)
    return {
        meal_type: float(amount)
        for meal_type, amount in rules.get("meal_prices", {}).items()
        if meal_type in SUPPORTED_MEAL_TYPES
    }


def meal_price_for_category(category, meal_type: str) -> float:
    return meal_prices_for_category(category).get(meal_type, 0.0)

def parse_holiday_dates(raw_value: str | None) -> set[date]:
    if not raw_value:
        return set()

    holidays: set[date] = set()
    for chunk in raw_value.split(","):
        normalized = chunk.strip()
        if not normalized:
            continue
        try:
            holidays.add(date.fromisoformat(normalized))
        except ValueError:
            continue
    return holidays


def get_service_day_status(target_date: date, holiday_dates: set[date]) -> tuple[bool, str | None]:
    if target_date.weekday() == 6:
        return False, "В выходные дни питание не выдается"
    if target_date in holiday_dates:
        return False, "В праздничные и неучебные дни питание не выдается"
    return True, None
