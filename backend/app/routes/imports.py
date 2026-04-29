from __future__ import annotations

from io import BytesIO

from flask import Blueprint, jsonify, request, send_file

from app.auth import login_required
from app.utils.audit import log_action
from app.utils.importer import IMPORT_HANDLERS, ImportValidationError, template_workbook_bytes

imports_bp = Blueprint("imports", __name__)


def parse_dry_run(value: str | None) -> bool:
    return str(value or "true").strip().lower() not in {"0", "false", "no"}


@imports_bp.get("/templates/<entity>.xlsx")
@login_required(roles=["head_social", "admin"])
def download_template(current_user, entity: str):
    if entity not in IMPORT_HANDLERS:
        return jsonify({"error": "Неизвестный тип шаблона"}), 404

    payload = template_workbook_bytes(entity)
    return send_file(
        BytesIO(payload),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"foodcontrol-{entity}-template.xlsx",
    )


@imports_bp.post("/<entity>")
@login_required(roles=["head_social", "admin"])
def import_entity(current_user, entity: str):
    handler = IMPORT_HANDLERS.get(entity)
    if not handler:
        return jsonify({"error": "Неизвестный тип импорта"}), 404

    upload = request.files.get("file")
    dry_run = parse_dry_run(request.form.get("dry_run"))

    try:
        summary = handler(upload, current_user, dry_run)
    except ImportValidationError as error:
        return jsonify({"error": error.message}), 400

    log_action(
        current_user,
        "preview_import" if dry_run else "run_import",
        "import",
        entity,
        {
            "entity": entity,
            "dry_run": dry_run,
            "total_rows": summary["total_rows"],
            "created": summary["created"],
            "updated": summary["updated"],
            "skipped": summary["skipped"],
            "errors": len(summary["errors"]),
        },
    )

    return jsonify(
        {
            "data": summary,
            "message": "Проверка файла завершена" if dry_run else "Импорт данных завершен",
        }
    )
