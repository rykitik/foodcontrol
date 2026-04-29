from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy.exc import IntegrityError

from app.models import Student, Ticket, db
from app.services.ticket_integrity import find_active_ticket_period_conflict
from app.services.ticket_lifecycle import build_ticket_batch
from app.services.ticket_periods import TicketPeriodSegment, format_ticket_period_segment, split_ticket_period_by_month
from app.utils.student_access import assigned_to_meal_building_expr


def build_active_ticket_exists_message(period_label: str | None = None) -> str:
    if period_label:
        return f"Активный талон за {period_label} уже существует"
    return "Активный талон на этот месяц уже существует"


def _counted_word(count: int, *, one: str, few: str, many: str) -> str:
    remainder_100 = count % 100
    remainder_10 = count % 10
    if 11 <= remainder_100 <= 14:
        return many
    if remainder_10 == 1:
        return one
    if 2 <= remainder_10 <= 4:
        return few
    return many


@dataclass(frozen=True)
class BulkIssueStudentSelection:
    requested_student_ids: list[str] | None
    students: list[Student]
    skipped_students: list[dict[str, str]]
    selected_student_count: int
    inactive_count: int
    unavailable_count: int


@dataclass(frozen=True)
class BulkIssuePreview:
    start_date: date
    end_date: date
    segments: list[TicketPeriodSegment]
    selected_student_count: int
    accessible_student_count: int
    issueable_students: list[Student]
    skipped_students: list[dict[str, str]]
    inactive_count: int
    unavailable_count: int
    conflict_count: int

    @property
    def issueable_student_count(self) -> int:
        return len(self.issueable_students)

    @property
    def total_ticket_count(self) -> int:
        return self.issueable_student_count * len(self.segments)

    def serialize(self) -> dict:
        return {
            "period_start": self.start_date.isoformat(),
            "period_end": self.end_date.isoformat(),
            "selected_student_count": self.selected_student_count,
            "accessible_student_count": self.accessible_student_count,
            "issueable_student_count": self.issueable_student_count,
            "total_ticket_count": self.total_ticket_count,
            "month_breakdown": [
                {
                    "month": segment.month,
                    "year": segment.year,
                    "label": format_ticket_period_segment(segment),
                    "student_count": self.issueable_student_count,
                    "ticket_count": self.issueable_student_count,
                }
                for segment in self.segments
            ],
            "warnings": self._build_warnings(),
            "skipped_students": self.skipped_students,
        }

    def _build_warnings(self) -> list[dict[str, int | str]]:
        warnings: list[dict[str, int | str]] = []
        if self.conflict_count:
            warnings.append(
                {
                    "code": "conflict",
                    "count": self.conflict_count,
                    "message": f"У {self.conflict_count} {_counted_word(self.conflict_count, one='студента', few='студентов', many='студентов')} уже есть талоны в выбранном периоде",
                }
            )
        if self.inactive_count:
            warnings.append(
                {
                    "code": "inactive",
                    "count": self.inactive_count,
                    "message": f"{self.inactive_count} {_counted_word(self.inactive_count, one='студент', few='студента', many='студентов')} неактивны",
                }
            )
        if self.unavailable_count:
            warnings.append(
                {
                    "code": "unavailable",
                    "count": self.unavailable_count,
                    "message": f"{self.unavailable_count} {_counted_word(self.unavailable_count, one='студент', few='студента', many='студентов')} недоступны для выдачи",
                }
            )
        return warnings


def resolve_requested_student_ids(raw_requested_student_ids) -> tuple[list[str] | None, str | None]:
    if raw_requested_student_ids is None:
        return None, None

    if not isinstance(raw_requested_student_ids, list) or not raw_requested_student_ids:
        return None, "student_ids должны быть непустым списком"

    requested_student_ids = list(dict.fromkeys(str(student_id).strip() for student_id in raw_requested_student_ids if str(student_id).strip()))
    if not requested_student_ids:
        return None, "student_ids должны быть непустым списком"

    return requested_student_ids, None


def load_bulk_issue_students(
    current_user,
    *,
    building_id: int | None,
    category_id: int | None,
    only_active: bool,
    requested_student_ids: list[str] | None,
) -> BulkIssueStudentSelection:
    query = Student.query
    if only_active:
        query = query.filter(Student.is_active.is_(True))
    if current_user.role == "social":
        query = query.filter(Student.building_id == current_user.building_id)
    elif building_id:
        query = query.filter(assigned_to_meal_building_expr(building_id))
    if category_id:
        query = query.filter(Student.category_id == category_id)
    if requested_student_ids:
        query = query.filter(Student.id.in_(requested_student_ids))

    students = query.order_by(Student.full_name.asc()).all()

    if not requested_student_ids:
        return BulkIssueStudentSelection(
            requested_student_ids=None,
            students=students,
            skipped_students=[],
            selected_student_count=len(students),
            inactive_count=0,
            unavailable_count=0,
        )

    requested_students = Student.query.filter(Student.id.in_(requested_student_ids)).all()
    requested_students_by_id = {student.id: student for student in requested_students}
    accessible_ids = {student.id for student in students}
    skipped_students: list[dict[str, str]] = []
    inactive_count = 0
    unavailable_count = 0

    for student_id in requested_student_ids:
        if student_id in accessible_ids:
            continue

        requested_student = requested_students_by_id.get(student_id)
        if requested_student is None:
            unavailable_count += 1
            skipped_students.append(
                {
                    "student_id": student_id,
                    "student_name": "—",
                    "reason": "Студент не найден или недоступен для выдачи",
                }
            )
            continue

        if only_active and not requested_student.is_active:
            inactive_count += 1
            skipped_students.append(
                {
                    "student_id": requested_student.id,
                    "student_name": requested_student.full_name,
                    "reason": "Студент неактивен",
                }
            )
            continue

        unavailable_count += 1
        skipped_students.append(
            {
                "student_id": requested_student.id,
                "student_name": requested_student.full_name,
                "reason": "Студент недоступен для выдачи",
            }
        )

    return BulkIssueStudentSelection(
        requested_student_ids=requested_student_ids,
        students=students,
        skipped_students=skipped_students,
        selected_student_count=len(requested_student_ids),
        inactive_count=inactive_count,
        unavailable_count=unavailable_count,
    )


def preview_bulk_ticket_issue(
    selection: BulkIssueStudentSelection,
    *,
    start_date: date,
    end_date: date,
) -> BulkIssuePreview:
    segments = split_ticket_period_by_month(start_date, end_date)
    issueable_students: list[Student] = []
    skipped_students = [*selection.skipped_students]
    conflict_count = 0

    for student in selection.students:
        existing, conflicting_segment = find_active_ticket_period_conflict(student.id, start_date, end_date)
        if existing and conflicting_segment:
            conflict_count += 1
            skipped_students.append(
                {
                    "student_id": student.id,
                    "student_name": student.full_name,
                    "reason": build_active_ticket_exists_message(format_ticket_period_segment(conflicting_segment)),
                }
            )
            continue

        issueable_students.append(student)

    return BulkIssuePreview(
        start_date=start_date,
        end_date=end_date,
        segments=segments,
        selected_student_count=selection.selected_student_count,
        accessible_student_count=len(selection.students),
        issueable_students=issueable_students,
        skipped_students=skipped_students,
        inactive_count=selection.inactive_count,
        unavailable_count=selection.unavailable_count,
        conflict_count=conflict_count,
    )


def create_bulk_tickets_from_preview(preview: BulkIssuePreview, current_user) -> tuple[list[Ticket], list[dict[str, str]], int]:
    created: list[Ticket] = []
    skipped_students = [*preview.skipped_students]
    created_student_count = 0

    for student in preview.issueable_students:
        try:
            with db.session.begin_nested():
                created.extend(build_ticket_batch(student, current_user.id, preview.start_date, preview.end_date))
            created_student_count += 1
        except IntegrityError:
            _conflict, conflicting_segment = find_active_ticket_period_conflict(student.id, preview.start_date, preview.end_date)
            skipped_students.append(
                {
                    "student_id": student.id,
                    "student_name": student.full_name,
                    "reason": build_active_ticket_exists_message(
                        format_ticket_period_segment(conflicting_segment) if conflicting_segment else None
                    ),
                }
            )

    return created, skipped_students, created_student_count
