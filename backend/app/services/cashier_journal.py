from __future__ import annotations

from collections import defaultdict
from datetime import date

from sqlalchemy.orm import joinedload

from app.models import MealRecord
from app.utils.buildings import building_name
from app.utils.student_access import get_effective_meal_building_id

MEAL_TYPE_LABELS = {
    "breakfast": "Завтрак",
    "lunch": "Обед",
}

ATTENTION_DEFINITIONS = {
    "duplicate_same_meal": {
        "label": "Один тип питания выдан несколько раз",
        "tone": "danger",
    },
    "multiple_buildings": {
        "label": "Выдача отмечена в разных корпусах",
        "tone": "warning",
    },
    "outside_assigned_building": {
        "label": "Выдача вне корпуса питания",
        "tone": "danger",
    },
}


def _round_amount(value: float) -> float:
    return round(value, 2)


def _serialize_scope(building_id: int | None) -> dict:
    return {
        "building_id": building_id,
        "building_name": building_name(building_id),
        "scope_label": building_name(building_id) or "Все корпуса",
    }


def _query_meal_records_for_date(*, target_date: date, building_id: int | None = None) -> list[MealRecord]:
    query = (
        MealRecord.query.options(
            joinedload(MealRecord.student),
            joinedload(MealRecord.cashier),
        )
        .filter(MealRecord.issue_date == target_date)
        .order_by(MealRecord.issue_time.desc(), MealRecord.id.desc())
    )
    if building_id is not None:
        query = query.filter(MealRecord.building_id == building_id)
    return query.all()


def _student_records_by_id(records: list[MealRecord]) -> dict[str, list[MealRecord]]:
    grouped: dict[str, list[MealRecord]] = defaultdict(list)
    for record in records:
        grouped[record.student_id].append(record)
    return grouped


def _build_student_attention_context(records: list[MealRecord]) -> dict:
    records_by_meal_type: dict[str, list[MealRecord]] = defaultdict(list)
    building_ids: set[int] = set()

    for record in records:
        records_by_meal_type[str(record.meal_type)].append(record)
        building_ids.add(int(record.building_id))

    duplicate_meal_types = sorted(
        meal_type
        for meal_type, grouped_records in records_by_meal_type.items()
        if len(grouped_records) > 1
    )
    return {
        "records_by_meal_type": records_by_meal_type,
        "duplicate_meal_types": duplicate_meal_types,
        "building_ids": sorted(building_ids),
        "building_names": [building_name(item) or f"Корпус {item}" for item in sorted(building_ids)],
        "has_multiple_buildings": len(building_ids) > 1,
    }


def _record_attention_codes(record: MealRecord, student_context: dict) -> list[str]:
    codes: list[str] = []
    if str(record.meal_type) in student_context["duplicate_meal_types"]:
        codes.append("duplicate_same_meal")

    if student_context["has_multiple_buildings"]:
        codes.append("multiple_buildings")

    effective_building_id = get_effective_meal_building_id(record.student)
    if effective_building_id is not None and int(record.building_id) != int(effective_building_id):
        codes.append("outside_assigned_building")

    return codes


def _describe_attention(code: str, *, record: MealRecord, student_context: dict) -> dict:
    definition = ATTENTION_DEFINITIONS[code]
    if code == "duplicate_same_meal":
        duplicate_records = student_context["records_by_meal_type"].get(str(record.meal_type), [])
        description = (
            f"{MEAL_TYPE_LABELS.get(str(record.meal_type), str(record.meal_type))} "
            f"отмечен {len(duplicate_records)} раза за день."
        )
    elif code == "multiple_buildings":
        description = f"За день есть выдачи в корпусах: {', '.join(student_context['building_names'])}."
    else:
        effective_building_id = get_effective_meal_building_id(record.student)
        effective_building_name = building_name(effective_building_id) or f"Корпус {effective_building_id}"
        description = (
            f"Фактическая выдача прошла в {building_name(record.building_id) or f'Корпус {record.building_id}'}, "
            f"хотя корпус питания студента: {effective_building_name}."
        )

    return {
        "code": code,
        "label": definition["label"],
        "tone": definition["tone"],
        "description": description,
    }


def _serialize_record(record: MealRecord, *, attention_flags: list[dict]) -> dict:
    student = record.student
    effective_building_id = get_effective_meal_building_id(student)
    return {
        "id": record.id,
        "ticket_id": record.ticket_id,
        "student_id": record.student_id,
        "student_name": student.full_name,
        "student_card": student.student_card,
        "group_name": student.group_name,
        "meal_type": record.meal_type,
        "meal_type_label": MEAL_TYPE_LABELS.get(str(record.meal_type), str(record.meal_type)),
        "issue_date": record.issue_date.isoformat(),
        "issue_time": record.issue_time.isoformat(),
        "issued_by": record.issued_by,
        "issued_by_name": record.cashier.full_name if record.cashier else "Касса",
        "building_id": record.building_id,
        "building_name": building_name(record.building_id),
        "source_building_id": student.building_id,
        "source_building_name": building_name(student.building_id),
        "meal_building_id": student.meal_building_id,
        "meal_building_name": building_name(student.meal_building_id),
        "effective_meal_building_id": effective_building_id,
        "effective_meal_building_name": building_name(effective_building_id),
        "allow_all_meal_buildings": bool(student.allow_all_meal_buildings),
        "category_name": student.category.name,
        "price": _round_amount(float(record.price or 0)),
        "notes": record.notes,
        "attention_flags": attention_flags,
        "has_attention": bool(attention_flags),
    }


def _build_attention_item(*, student_records: list[MealRecord], scoped_records: list[MealRecord], student_context: dict) -> dict | None:
    matching_record_by_code: dict[str, MealRecord] = {}
    for record in student_records:
        for code in _record_attention_codes(record, student_context):
            matching_record_by_code.setdefault(code, record)

    deduplicated_codes = [code for code in ATTENTION_DEFINITIONS if code in matching_record_by_code]
    if not deduplicated_codes:
        return None

    student = scoped_records[0].student
    unique_meal_types = []
    for meal_type in (record.meal_type for record in student_records):
        if meal_type not in unique_meal_types:
            unique_meal_types.append(meal_type)

    return {
        "student_id": student.id,
        "student_name": student.full_name,
        "student_card": student.student_card,
        "group_name": student.group_name,
        "codes": deduplicated_codes,
        "labels": [ATTENTION_DEFINITIONS[code]["label"] for code in deduplicated_codes],
        "reasons": [
            _describe_attention(code, record=matching_record_by_code[code], student_context=student_context)["description"]
            for code in deduplicated_codes
        ],
        "meal_types": unique_meal_types,
        "meal_type_labels": [MEAL_TYPE_LABELS.get(str(item), str(item)) for item in unique_meal_types],
        "buildings": [
            {
                "building_id": building_id,
                "building_name": building_name(building_id) or f"Корпус {building_id}",
            }
            for building_id in student_context["building_ids"]
        ],
        "record_count": len(student_records),
        "scoped_record_ids": [record.id for record in scoped_records],
    }


def build_cashier_journal(*, target_date: date, history_building_id: int | None) -> dict:
    scoped_records = _query_meal_records_for_date(target_date=target_date, building_id=history_building_id)
    scoped_student_ids = sorted({record.student_id for record in scoped_records})
    related_records = _query_meal_records_for_date(target_date=target_date)
    related_records = [record for record in related_records if record.student_id in scoped_student_ids]

    related_records_by_student = _student_records_by_id(related_records)
    scoped_records_by_student = _student_records_by_id(scoped_records)

    serialized_records = []
    attention_items = []

    for record in scoped_records:
        student_records = related_records_by_student.get(record.student_id, [record])
        student_context = _build_student_attention_context(student_records)
        attention_codes = _record_attention_codes(record, student_context)
        attention_flags = [
            _describe_attention(code, record=record, student_context=student_context)
            for code in attention_codes
        ]
        serialized_records.append(_serialize_record(record, attention_flags=attention_flags))

    for student_id, student_records in related_records_by_student.items():
        scoped_student_records = scoped_records_by_student.get(student_id, [])
        if not scoped_student_records:
            continue
        attention_item = _build_attention_item(
            student_records=student_records,
            scoped_records=scoped_student_records,
            student_context=_build_student_attention_context(student_records),
        )
        if attention_item is not None:
            attention_items.append(attention_item)

    duplicate_same_meal_count = sum(
        1 for item in attention_items if "duplicate_same_meal" in item["codes"]
    )
    multiple_buildings_count = sum(
        1 for item in attention_items if "multiple_buildings" in item["codes"]
    )
    outside_assigned_building_count = sum(
        1 for item in attention_items if "outside_assigned_building" in item["codes"]
    )

    return {
        "date": target_date.isoformat(),
        "scope": _serialize_scope(history_building_id),
        "summary": {
            "records_count": len(serialized_records),
            "students_count": len({record["student_id"] for record in serialized_records}),
            "attention_records_count": sum(1 for record in serialized_records if record["has_attention"]),
            "attention_students_count": len(attention_items),
            "duplicate_same_meal_count": duplicate_same_meal_count,
            "multiple_buildings_count": multiple_buildings_count,
            "outside_assigned_building_count": outside_assigned_building_count,
            "total_amount": _round_amount(sum(record["price"] for record in serialized_records)),
        },
        "attention_items": attention_items,
        "records": serialized_records,
    }
