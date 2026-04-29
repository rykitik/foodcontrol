from __future__ import annotations

import re
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

import pandas as pd
from werkzeug.datastructures import FileStorage

from app.models import Category, Student, db
from app.services.student_cards import generate_next_student_card


TRUE_VALUES = {"1", "true", "yes", "y", "да", "активен", "active"}
FALSE_VALUES = {"0", "false", "no", "n", "нет", "неактивен", "inactive", "disabled"}

ENTITY_ALIASES = {
    "students": {
        "full_name": {"full_name", "full name", "fio", "фио", "student_name", "name"},
        "student_card": {"student_card", "student card", "номер_студенческого", "номер студенческого", "студенческий", "card"},
        "group_name": {"group_name", "group", "группа"},
        "building_id": {"building_id", "building", "корпус"},
        "category_id": {"category_id"},
        "category_code": {"category_code", "код_категории", "код категории"},
        "category_name": {"category_name", "category", "категория"},
        "is_active": {"is_active", "active", "активен", "enabled"},
    },
}


@dataclass
class ImportValidationError(Exception):
    field: str
    message: str

    def __str__(self) -> str:
        return self.message


def normalize_column_name(value: str) -> str:
    normalized = re.sub(r"[^0-9a-zA-Zа-яА-Я]+", "_", str(value).strip().lower())
    return normalized.strip("_")


def normalize_cell(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def parse_bool(value, default: bool = True) -> bool:
    normalized = normalize_cell(value).lower()
    if not normalized:
        return default
    if normalized in TRUE_VALUES:
        return True
    if normalized in FALSE_VALUES:
        return False
    raise ImportValidationError("is_active", f"Не удалось распознать булево значение: {value}")


def parse_int(value, field_name: str, required: bool = True) -> int | None:
    normalized = normalize_cell(value)
    if not normalized:
        if required:
            raise ImportValidationError(field_name, f"Поле {field_name} обязательно")
        return None
    try:
        return int(float(normalized))
    except ValueError as error:
        raise ImportValidationError(field_name, f"Поле {field_name} должно быть числом") from error


def parse_optional_int(value, field_name: str) -> int | None:
    return parse_int(value, field_name, required=False)


def load_import_dataframe(upload: FileStorage, entity: str) -> pd.DataFrame:
    if not upload or not upload.filename:
        raise ImportValidationError("file", "Файл не передан")

    extension = Path(upload.filename).suffix.lower()
    upload.stream.seek(0)

    if extension == ".csv":
        frame = pd.read_csv(upload.stream, dtype=str, keep_default_na=False)
    elif extension in {".xlsx", ".xls"}:
        frame = pd.read_excel(upload.stream, dtype=str, keep_default_na=False)
    else:
        raise ImportValidationError("file", "Поддерживаются только CSV, XLSX и XLS")

    frame = frame.fillna("")
    aliases = ENTITY_ALIASES[entity]
    normalized_columns = {column: normalize_column_name(column) for column in frame.columns}

    rename_map: dict[str, str] = {}
    for original, normalized in normalized_columns.items():
        for target, variants in aliases.items():
            if normalized == target or normalized in {normalize_column_name(item) for item in variants}:
                rename_map[original] = target
                break

    return frame.rename(columns=rename_map)


def template_workbook_bytes(entity: str) -> bytes:
    if entity != "students":
        raise ImportValidationError("entity", "Неизвестный тип шаблона")

    frame = pd.DataFrame(
        [
            {
                "ФИО": "Иванов Иван Иванович",
                "Группа": "ИСП-201",
                "Корпус": "1",
                "Категория": "ОВЗ",
            }
        ]
    )

    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        frame.to_excel(writer, index=False, sheet_name="Студенты")
    return buffer.getvalue()


def summarize(
    entity: str,
    dry_run: bool,
    total_rows: int,
    created: int,
    updated: int,
    skipped: int,
    errors: list[dict],
    columns: list[str],
) -> dict:
    return {
        "entity": entity,
        "dry_run": dry_run,
        "total_rows": total_rows,
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
        "columns": columns,
    }


def resolve_category(row: pd.Series) -> Category:
    category_id = normalize_cell(row.get("category_id"))
    if category_id:
        category = Category.query.filter_by(id=int(float(category_id))).first()
        if category:
            return category

    category_code = normalize_cell(row.get("category_code")).lower()
    if category_code:
        category = Category.query.filter(Category.code.ilike(category_code)).first()
        if category:
            return category

    category_name = normalize_cell(row.get("category_name"))
    if category_name:
        category = Category.query.filter(Category.name.ilike(category_name)).first()
        if category:
            return category

    raise ImportValidationError("category", "Категория не найдена")


def find_existing_student_for_import(
    *,
    full_name: str,
    group_name: str,
    building_id: int,
    student_card: str,
) -> Student | None:
    if student_card:
        student = Student.query.filter_by(student_card=student_card).first()
        if student is not None:
            return student

    matches = (
        Student.query.filter_by(
            full_name=full_name,
            group_name=group_name,
            building_id=building_id,
        )
        .order_by(Student.created_at.asc(), Student.id.asc())
        .all()
    )
    if len(matches) > 1:
        raise ImportValidationError(
            "row",
            "Найдено несколько студентов с одинаковыми ФИО, группой и корпусом. Уточните данные вручную.",
        )
    return matches[0] if matches else None


def import_students(upload: FileStorage, current_user, dry_run: bool) -> dict:
    frame = load_import_dataframe(upload, "students")
    required_columns = {"full_name", "group_name", "building_id"}
    missing = sorted(column for column in required_columns if column not in frame.columns)
    if missing:
        raise ImportValidationError("columns", f"Не хватает колонок: {', '.join(missing)}")
    if not any(column in frame.columns for column in {"category_id", "category_code", "category_name"}):
        raise ImportValidationError("columns", "Не хватает колонки категории")

    created = 0
    updated = 0
    skipped = 0
    errors: list[dict] = []

    for row_number, (_index, row) in enumerate(frame.iterrows(), start=2):
        try:
            full_name = normalize_cell(row.get("full_name"))
            student_card = normalize_cell(row.get("student_card"))
            group_name = normalize_cell(row.get("group_name"))
            building_id = parse_int(row.get("building_id"), "building_id")
            category = resolve_category(row)

            if current_user.role in {"social", "cashier"} and current_user.building_id != building_id:
                raise ImportValidationError("building_id", "Нет доступа к указанному корпусу")
            if not full_name or not group_name:
                raise ImportValidationError("row", "ФИО и группа обязательны")

            student = find_existing_student_for_import(
                full_name=full_name,
                group_name=group_name,
                building_id=building_id,
                student_card=student_card,
            )
            is_new = student is None
            if is_new:
                student = Student(
                    student_card=generate_next_student_card(db.session),
                    full_name=full_name,
                    group_name=group_name,
                    building_id=building_id,
                    category_id=category.id,
                )
                db.session.add(student)

            student.full_name = full_name
            student.group_name = group_name
            student.building_id = building_id
            student.category_id = category.id
            if "is_active" in frame.columns:
                student.is_active = parse_bool(row.get("is_active"), default=True)

            db.session.flush()
            created += int(is_new)
            updated += int(not is_new)
        except ImportValidationError as error:
            skipped += 1
            errors.append({"row": row_number, "field": error.field, "message": error.message})

    if dry_run:
        db.session.rollback()
    else:
        db.session.commit()

    return summarize("students", dry_run, len(frame.index), created, updated, skipped, errors, list(frame.columns))


IMPORT_HANDLERS = {
    "students": import_students,
}
