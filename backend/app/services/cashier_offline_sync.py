from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from app.models import db


OfflineSyncStatus = str


@dataclass(slots=True)
class OfflineSyncResultItem:
    client_item_id: str
    request_id: str
    status: OfflineSyncStatus
    http_status: int
    message: str | None
    data: dict[str, Any] | None


def normalize_offline_sync_items(raw_items: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_items, list):
        return []

    normalized: list[dict[str, Any]] = []
    for index, item in enumerate(raw_items):
        if not isinstance(item, dict):
            normalized.append(
                {
                    "client_item_id": f"item-{index}",
                    "request_id": "",
                    "payload": None,
                    "invalid": True,
                    "error": "offline sync item must be an object",
                }
            )
            continue

        payload = item.get("request") if isinstance(item.get("request"), dict) else item
        request_id = (payload.get("request_id") or item.get("request_id") or "").strip() if isinstance(payload, dict) else ""
        client_item_id = (
            str(item.get("client_item_id") or item.get("queue_item_id") or request_id or f"item-{index}").strip()
            or f"item-{index}"
        )

        normalized.append(
            {
                "client_item_id": client_item_id,
                "request_id": request_id,
                "payload": payload if isinstance(payload, dict) else None,
                "invalid": False,
                "error": None,
            }
        )

    return normalized


def classify_sync_status(http_status: int) -> OfflineSyncStatus:
    if 200 <= http_status < 300:
        return "acked"
    if http_status == 409:
        return "needs_review"
    return "rejected"


def summarize_sync_results(items: list[OfflineSyncResultItem]) -> dict[str, int]:
    summary = {"acked": 0, "rejected": 0, "needs_review": 0}
    for item in items:
        if item.status in summary:
            summary[item.status] += 1
    return summary


def run_offline_sync_batch(
    *,
    raw_items: Any,
    process_item: Callable[[dict[str, Any]], tuple[int, dict[str, Any]]],
) -> list[OfflineSyncResultItem]:
    normalized_items = normalize_offline_sync_items(raw_items)
    results: list[OfflineSyncResultItem] = []

    for item in normalized_items:
        if item["invalid"]:
            results.append(
                OfflineSyncResultItem(
                    client_item_id=item["client_item_id"],
                    request_id=item["request_id"],
                    status="rejected",
                    http_status=400,
                    message=item["error"],
                    data=None,
                )
            )
            continue

        payload = item["payload"]
        if payload is None:
            results.append(
                OfflineSyncResultItem(
                    client_item_id=item["client_item_id"],
                    request_id=item["request_id"],
                    status="rejected",
                    http_status=400,
                    message="offline sync payload is missing",
                    data=None,
                )
            )
            continue

        try:
            status_code, response_payload = process_item(payload)
            response_data = response_payload.get("data") if isinstance(response_payload, dict) else None
            message = None
            if isinstance(response_payload, dict):
                message = response_payload.get("message") or response_payload.get("error")

            results.append(
                OfflineSyncResultItem(
                    client_item_id=item["client_item_id"],
                    request_id=(response_data.get("request_id") if isinstance(response_data, dict) else None)
                    or item["request_id"],
                    status=classify_sync_status(status_code),
                    http_status=status_code,
                    message=message,
                    data=response_data if isinstance(response_data, dict) else None,
                )
            )
        except Exception as exc:  # pragma: no cover - defensive branch
            db.session.rollback()
            results.append(
                OfflineSyncResultItem(
                    client_item_id=item["client_item_id"],
                    request_id=item["request_id"],
                    status="needs_review",
                    http_status=500,
                    message=str(exc) or "offline sync failed",
                    data=None,
                )
            )

    return results

