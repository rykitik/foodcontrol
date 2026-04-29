from __future__ import annotations

from datetime import date

from app.models import Ticket, db


def sync_ticket_statuses() -> None:
    updated = (
        Ticket.query.filter(Ticket.status == "active", Ticket.end_date < date.today())
        .update({Ticket.status: "expired"}, synchronize_session=False)
    )
    if updated:
        db.session.commit()
