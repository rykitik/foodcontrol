from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Student

STUDENT_CARD_START = 100001


def parse_numeric_student_card(value: str | None) -> int | None:
    normalized = (value or "").strip()
    if not normalized.isdigit():
        return None
    return int(normalized)


def generate_next_student_card(session: Session) -> str:
    max_student_card = STUDENT_CARD_START - 1

    for student_card, in session.query(Student.student_card).all():
        numeric_student_card = parse_numeric_student_card(student_card)
        if numeric_student_card is None:
            continue
        max_student_card = max(max_student_card, numeric_student_card)

    return str(max_student_card + 1)
