from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy.exc import IntegrityError

from app.models import AccountingDocumentMetadataOverride, Category, Student, Ticket, User, db
from app.utils.audit import log_action


class CategoryMutationError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class ParsedCategoryPrice:
    value: float | None
    is_present: bool


CODE_PATTERN = re.compile(r"^[a-z0-9_]{2,20}$")

CYRILLIC_TRANSLIT = str.maketrans(
    {
        "а": "a",
        "б": "b",
        "в": "v",
        "г": "g",
        "д": "d",
        "е": "e",
        "ё": "e",
        "ж": "zh",
        "з": "z",
        "и": "i",
        "й": "y",
        "к": "k",
        "л": "l",
        "м": "m",
        "н": "n",
        "о": "o",
        "п": "p",
        "р": "r",
        "с": "s",
        "т": "t",
        "у": "u",
        "ф": "f",
        "х": "h",
        "ц": "c",
        "ч": "ch",
        "ш": "sh",
        "щ": "sch",
        "ъ": "",
        "ы": "y",
        "ь": "",
        "э": "e",
        "ю": "yu",
        "я": "ya",
    }
)


def parse_category_price(payload: dict, field_name: str) -> ParsedCategoryPrice:
    if field_name not in payload:
        return ParsedCategoryPrice(value=None, is_present=False)

    raw_value = payload.get(field_name)
    if raw_value in {None, ""}:
        return ParsedCategoryPrice(value=0.0, is_present=True)

    try:
        value = round(float(raw_value), 2)
    except (TypeError, ValueError) as exc:
        raise CategoryMutationError(f"Некорректное значение {field_name}") from exc

    if value < 0:
        raise CategoryMutationError(f"{field_name} не может быть отрицательной")

    return ParsedCategoryPrice(value=value, is_present=True)


def parse_category_name(payload: dict, *, required: bool) -> str | None:
    if "name" not in payload:
        if required:
            raise CategoryMutationError("Нужно указать название категории")
        return None

    name = (payload.get("name") or "").strip()
    if not name:
        raise CategoryMutationError("Название категории не может быть пустым")
    if len(name) > 100:
        raise CategoryMutationError("Название категории не должно быть длиннее 100 символов")

    return name


def parse_category_code(payload: dict, *, required: bool) -> str | None:
    if "code" not in payload:
        if required:
            raise CategoryMutationError("Нужно указать код категории")
        return None

    code = (payload.get("code") or "").strip().lower()
    if not code:
        raise CategoryMutationError("Код категории не может быть пустым")
    if not CODE_PATTERN.fullmatch(code):
        raise CategoryMutationError("Код категории должен содержать 2-20 символов: a-z, 0-9 или _")

    return code


def category_name_exists(name: str, *, exclude_id: int | None = None) -> bool:
    normalized_name = name.casefold()
    categories = Category.query.with_entities(Category.id, Category.name).all()
    return any(
        category.id != exclude_id and category.name.casefold() == normalized_name
        for category in categories
    )


def category_code_exists(code: str, *, exclude_id: int | None = None) -> bool:
    normalized_code = code.casefold()
    categories = Category.query.with_entities(Category.id, Category.code).all()
    return any(
        category.id != exclude_id and category.code.casefold() == normalized_code
        for category in categories
    )


def build_category_code(name: str, *, exclude_id: int | None = None) -> str:
    slug = name.lower().translate(CYRILLIC_TRANSLIT)
    slug = re.sub(r"[^a-z0-9]+", "_", slug).strip("_") or "category"
    base = slug[:20].strip("_") or "category"
    candidate = base
    counter = 2

    while category_code_exists(candidate, exclude_id=exclude_id):
        suffix = f"_{counter}"
        candidate = f"{base[: 20 - len(suffix)].rstrip('_')}{suffix}"
        counter += 1

    return candidate


def _normalize_optional_text(value) -> str | None:
    normalized = (value or "").strip()
    return normalized or None


def _commit_category_mutation(conflict_message: str) -> None:
    try:
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise CategoryMutationError(conflict_message, status_code=409) from exc


def _metadata_override_scope(row: AccountingDocumentMetadataOverride, category_code: str) -> str:
    meal_type = row.meal_type or "none"
    return f"{row.document_kind}:{category_code}:{meal_type}:{row.year:04d}-{row.month:02d}"


def _rename_category_metadata_overrides(old_code: str, new_code: str) -> None:
    rows = AccountingDocumentMetadataOverride.query.filter_by(category_code=old_code).all()
    for row in rows:
        row.category_code = new_code
        row.scope = _metadata_override_scope(row, new_code)


def _resolve_replacement_category(category: Category, payload: dict, student_count: int) -> Category | None:
    replacement_id = payload.get("replacement_category_id")
    if student_count == 0 and replacement_id in {None, ""}:
        return None
    if replacement_id in {None, ""}:
        raise CategoryMutationError("Для удаления категории со студентами нужно выбрать категорию-замену")

    try:
        replacement_id = int(replacement_id)
    except (TypeError, ValueError) as exc:
        raise CategoryMutationError("Некорректная категория-замена") from exc

    if replacement_id == category.id:
        raise CategoryMutationError("Нельзя перевести студентов в удаляемую категорию")

    replacement = Category.query.filter_by(id=replacement_id, is_active=True).first()
    if replacement is None:
        raise CategoryMutationError("Категория-замена не найдена")

    return replacement


def create_category(current_user: User, payload: dict) -> Category:
    name = parse_category_name(payload, required=True)
    assert name is not None
    requested_code = parse_category_code(payload, required=False)

    if category_name_exists(name):
        raise CategoryMutationError("Категория с таким названием уже существует", status_code=409)
    if requested_code is not None and category_code_exists(requested_code):
        raise CategoryMutationError("Категория с таким кодом уже существует", status_code=409)

    breakfast_price = parse_category_price(payload, "breakfast_price")
    lunch_price = parse_category_price(payload, "lunch_price")

    category = Category(
        name=name,
        code=requested_code or build_category_code(name),
        breakfast=bool(payload.get("breakfast", False)),
        lunch=bool(payload.get("lunch", False)),
        dinner=False,
        breakfast_price=breakfast_price.value if breakfast_price.is_present else 0.0,
        lunch_price=lunch_price.value if lunch_price.is_present else 0.0,
        description=_normalize_optional_text(payload.get("description")),
        color=_normalize_optional_text(payload.get("color")),
        is_active=True,
    )

    db.session.add(category)
    _commit_category_mutation("Не удалось создать категорию: название или код уже заняты")
    log_action(
        current_user,
        "create_category",
        "category",
        str(category.id),
        {
            "name": category.name,
            "code": category.code,
            "breakfast": category.breakfast,
            "lunch": category.lunch,
            "breakfast_price": float(category.breakfast_price or 0),
            "lunch_price": float(category.lunch_price or 0),
            "description": category.description,
            "color": category.color,
        },
    )
    return category


def update_category(current_user: User, category: Category, payload: dict) -> Category:
    if not category.is_active:
        raise CategoryMutationError("Удаленную категорию нельзя редактировать", status_code=409)

    name = parse_category_name(payload, required=False)
    if name is not None and name != category.name:
        if category_name_exists(name, exclude_id=category.id):
            raise CategoryMutationError("Категория с таким названием уже существует", status_code=409)
        category.name = name

    code = parse_category_code(payload, required=False)
    old_code = category.code
    if code is not None and code != category.code:
        if category_code_exists(code, exclude_id=category.id):
            raise CategoryMutationError("Категория с таким кодом уже существует", status_code=409)
        category.code = code
        _rename_category_metadata_overrides(old_code, code)

    breakfast_price = parse_category_price(payload, "breakfast_price")
    lunch_price = parse_category_price(payload, "lunch_price")

    if "breakfast" in payload:
        category.breakfast = bool(payload["breakfast"])
    if "lunch" in payload:
        category.lunch = bool(payload["lunch"])
    if breakfast_price.is_present:
        category.breakfast_price = breakfast_price.value
    if lunch_price.is_present:
        category.lunch_price = lunch_price.value
    if "description" in payload:
        category.description = _normalize_optional_text(payload.get("description"))
    if "color" in payload:
        category.color = _normalize_optional_text(payload.get("color"))

    _commit_category_mutation("Не удалось обновить категорию: название или код уже заняты")
    log_action(
        current_user,
        "update_category",
        "category",
        str(category.id),
        {
            "name": category.name,
            "code": category.code,
            "breakfast": category.breakfast,
            "lunch": category.lunch,
            "breakfast_price": float(category.breakfast_price or 0),
            "lunch_price": float(category.lunch_price or 0),
            "description": category.description,
            "color": category.color,
        },
    )
    return category


def archive_category(current_user: User, category: Category, payload: dict) -> dict:
    if not category.is_active:
        raise CategoryMutationError("Категория уже удалена", status_code=409)

    active_category_count = Category.query.filter(Category.is_active.is_(True)).count()
    if active_category_count <= 1:
        raise CategoryMutationError("Нельзя удалить последнюю активную категорию", status_code=409)

    student_count = Student.query.filter_by(category_id=category.id).count()
    replacement = _resolve_replacement_category(category, payload, student_count)
    transferred_students = 0

    if replacement is not None:
        transferred_students = Student.query.filter_by(category_id=category.id).update(
            {"category_id": replacement.id},
            synchronize_session=False,
        )
        Ticket.query.filter_by(category_id=category.id, status="active").update(
            {"category_id": replacement.id},
            synchronize_session=False,
        )

    category.is_active = False
    _commit_category_mutation("Не удалось удалить категорию")
    log_action(
        current_user,
        "archive_category",
        "category",
        str(category.id),
        {
            "name": category.name,
            "code": category.code,
            "replacement_category_id": replacement.id if replacement else None,
            "transferred_students": transferred_students,
        },
    )
    return {
        "id": category.id,
        "replacement_category_id": replacement.id if replacement else None,
        "transferred_students": transferred_students,
    }
