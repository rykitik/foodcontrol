from __future__ import annotations

from sqlalchemy import func

from app.models import Student

DEFAULT_GROUP_SUGGESTION_LIMIT = 20
MAX_GROUP_SUGGESTION_LIMIT = 50


def normalize_group_query(value: str | None) -> str:
    return (value or "").strip()


def normalize_group_limit(value: int | None) -> int:
    if value is None:
        return DEFAULT_GROUP_SUGGESTION_LIMIT

    return min(max(value, 1), MAX_GROUP_SUGGESTION_LIMIT)


def list_student_group_names(current_user, *, query_text: str = "", building_id: int | None = None, limit: int | None = None) -> list[str]:
    resolved_query = normalize_group_query(query_text)
    resolved_limit = normalize_group_limit(limit)

    query = Student.query.with_entities(Student.group_name).filter(func.trim(Student.group_name) != "")

    if resolved_query:
        query = query.filter(Student.group_name.ilike(f"%{resolved_query}%"))

    if current_user.role == "social":
        query = query.filter(Student.building_id == current_user.building_id)
    elif building_id:
        query = query.filter(Student.building_id == building_id)

    rows = query.group_by(Student.group_name).order_by(func.lower(Student.group_name).asc()).limit(resolved_limit * 2).all()

    group_names: list[str] = []
    seen_names: set[str] = set()
    for (group_name,) in rows:
        normalized_name = group_name.strip()
        lookup_key = normalized_name.casefold()
        if not normalized_name or lookup_key in seen_names:
            continue

        seen_names.add(lookup_key)
        group_names.append(normalized_name)
        if len(group_names) >= resolved_limit:
            break

    return group_names
