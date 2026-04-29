from __future__ import annotations

BUILDING_LABELS = {
    1: "Корпус 1, Ленина, д.9",
    2: "Корпус 2, Яковлева, д.17",
    3: "Корпус 3, Яковлева, д.20/1",
    4: "Корпус 4, Пр. Мира, д.40",
    5: "Корпус 5, пр. Тракторостроителей, д.99",
}


def building_name(building_id: int | None) -> str | None:
    if not building_id:
        return None
    return BUILDING_LABELS.get(int(building_id), f"Корпус {building_id}")


def known_building_ids() -> list[int]:
    return sorted(BUILDING_LABELS)
