from __future__ import annotations

from datetime import date

from flask import Blueprint, jsonify, request
from sqlalchemy import extract

from app.auth import login_required
from app.models import HolidayCalendar, db
from app.services.holidays import (
    create_holiday_entry,
    create_holiday_range,
    parse_holiday_date,
    validate_holiday_range,
)
from app.serializers import serialize_holiday
from app.utils.audit import log_action
from app.utils.official_holidays import ensure_official_holidays_for_years

holidays_bp = Blueprint("holidays", __name__)


@holidays_bp.get("")
@login_required()
def list_holidays(current_user):
    query = HolidayCalendar.query

    year = request.args.get("year", type=int)
    month = request.args.get("month", type=int)
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    include_inactive = request.args.get("include_inactive") in {"1", "true", "True"}

    parsed_start = None
    parsed_end = None
    if start_date:
        parsed_start, error = parse_holiday_date(start_date, "start_date")
        if error:
            return jsonify({"error": error}), 400
    if end_date:
        parsed_end, error = parse_holiday_date(end_date, "end_date")
        if error:
            return jsonify({"error": error}), 400

    years_to_sync: set[int] = set()
    if year:
        years_to_sync.add(year)
    if parsed_start and parsed_end:
        years_to_sync.update(range(parsed_start.year, parsed_end.year + 1))
    else:
        if parsed_start:
            years_to_sync.add(parsed_start.year)
        if parsed_end:
            years_to_sync.add(parsed_end.year)
    if not years_to_sync:
        years_to_sync.add(date.today().year)
    ensure_official_holidays_for_years(years_to_sync)

    if year:
        query = query.filter(extract("year", HolidayCalendar.holiday_date) == year)
    if month:
        query = query.filter(extract("month", HolidayCalendar.holiday_date) == month)
    if parsed_start:
        query = query.filter(HolidayCalendar.holiday_date >= parsed_start)
    if parsed_end:
        query = query.filter(HolidayCalendar.holiday_date <= parsed_end)
    if not include_inactive:
        query = query.filter(HolidayCalendar.is_active.is_(True))

    holidays = query.order_by(HolidayCalendar.holiday_date.asc()).all()
    return jsonify({"data": [serialize_holiday(entry) for entry in holidays]})


@holidays_bp.post("")
@login_required(roles=["head_social", "admin"])
def create_holiday(current_user):
    payload = request.get_json(silent=True) or {}
    parsed_date, error = parse_holiday_date(payload.get("holiday_date"), "holiday_date")
    if error:
        return jsonify({"error": error}), 400

    entry, conflict = create_holiday_entry(
        holiday_date=parsed_date,
        title=payload.get("title"),
        is_active=bool(payload.get("is_active", True)),
        created_by=current_user.id,
    )
    if conflict:
        return jsonify({"error": conflict}), 409

    db.session.commit()
    log_action(current_user, "create_holiday", "holiday", str(entry.id), {"holiday_date": entry.holiday_date.isoformat()})
    return jsonify({"data": serialize_holiday(entry), "message": "Праздничный день добавлен"}), 201


@holidays_bp.post("/bulk")
@login_required(roles=["head_social", "admin"])
def create_holidays_bulk(current_user):
    payload = request.get_json(silent=True) or {}

    start_date, start_error = parse_holiday_date(payload.get("start_date"), "start_date")
    if start_error:
        return jsonify({"error": start_error}), 400

    end_date, end_error = parse_holiday_date(payload.get("end_date"), "end_date")
    if end_error:
        return jsonify({"error": end_error}), 400

    range_error = validate_holiday_range(start_date, end_date)
    if range_error:
        return jsonify({"error": range_error}), 400

    result = create_holiday_range(
        start_date=start_date,
        end_date=end_date,
        title=payload.get("title"),
        is_active=bool(payload.get("is_active", True)),
        created_by=current_user.id,
    )
    db.session.commit()

    log_action(
        current_user,
        "create_holiday_bulk",
        "holiday_batch",
        None,
        {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "created_count": len(result.created_entries),
            "skipped_count": len(result.skipped_dates),
        },
    )

    message = "Диапазон дат обработан"
    if result.created_entries and result.skipped_dates:
        message = "Диапазон добавлен частично: существующие даты пропущены"
    elif result.created_entries:
        message = "Диапазон дат добавлен"
    elif result.skipped_dates:
        message = "Все даты из диапазона уже существуют"

    status_code = 201 if result.created_entries else 200
    return (
        jsonify(
            {
                "data": {
                    "created_count": len(result.created_entries),
                    "skipped_count": len(result.skipped_dates),
                    "created": [serialize_holiday(entry) for entry in result.created_entries],
                    "skipped_dates": [value.isoformat() for value in result.skipped_dates],
                },
                "message": message,
            }
        ),
        status_code,
    )


@holidays_bp.patch("/<int:holiday_id>")
@login_required(roles=["head_social", "admin"])
def update_holiday(current_user, holiday_id: int):
    entry = HolidayCalendar.query.filter_by(id=holiday_id).first_or_404()
    payload = request.get_json(silent=True) or {}

    if "holiday_date" in payload:
        parsed_date, error = parse_holiday_date(payload.get("holiday_date"), "holiday_date")
        if error:
            return jsonify({"error": error}), 400

        duplicate = HolidayCalendar.query.filter(
            HolidayCalendar.id != entry.id,
            HolidayCalendar.holiday_date == parsed_date,
        ).first()
        if duplicate:
            return jsonify({"error": "Для этой даты запись уже существует"}), 409
        entry.holiday_date = parsed_date

    if "title" in payload:
        entry.title = (payload.get("title") or "").strip() or None
    if "is_active" in payload:
        entry.is_active = bool(payload["is_active"])

    db.session.commit()
    log_action(
        current_user,
        "update_holiday",
        "holiday",
        str(entry.id),
        {"holiday_date": entry.holiday_date.isoformat(), "is_active": entry.is_active},
    )
    return jsonify({"data": serialize_holiday(entry), "message": "Праздничный день обновлен"})


@holidays_bp.delete("/<int:holiday_id>")
@login_required(roles=["head_social", "admin"])
def delete_holiday(current_user, holiday_id: int):
    entry = HolidayCalendar.query.filter_by(id=holiday_id).first_or_404()
    details = {"holiday_date": entry.holiday_date.isoformat(), "title": entry.title}
    db.session.delete(entry)
    db.session.commit()
    log_action(current_user, "delete_holiday", "holiday", str(holiday_id), details)
    return jsonify({"message": "Праздничный день удален"})
