"""Reservation HTTP handlers; original request/response contracts preserved."""

import os, secrets, io, qrcode
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import Response
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from ..core.security import user, admin, internal
from ..core.config import INTERNAL
from ..db.database import db
from ..models.entities import Reservation, Ticket
from ..schemas.reservations import ReserveIn, ValidateIn
from ..services.helpers import utcnow, expire, asdict, catalog, event_info, write_audit
from ..services.notifications import email_confirmation_job
from ..documents import ticket_pdf, summary_pdf

router = APIRouter()


@router.get("/internal/report", dependencies=[Depends(internal)])
def report(
    from_date: str | None = None,
    to_date: str | None = None,
    event_id: str | None = None,
    status: str | None = None,
    s: Session = Depends(db),
):
    expire(s)
    s.commit()
    q = select(Reservation)
    if from_date:
        q = q.where(
            Reservation.created_at
            >= datetime.fromisoformat(from_date).replace(tzinfo=timezone.utc)
        )
    if to_date:
        q = q.where(
            Reservation.created_at
            < datetime.fromisoformat(to_date).replace(tzinfo=timezone.utc)
            + timedelta(days=1)
        )
    if event_id:
        q = q.where(Reservation.event_id == event_id)
    if status:
        q = q.where(Reservation.status == status)
    rows = s.scalars(q).all()
    totals = defaultdict(
        lambda: {
            "reservations": 0,
            "tickets": 0,
            "revenue": 0,
            "sections": defaultdict(int),
            "section_revenue": defaultdict(float),
        }
    )
    for r in rows:
        a = totals[r.event_id]
        a["reservations"] += 1
        if r.status == "CONFIRMED":
            a["tickets"] += len(r.tickets)
            a["revenue"] += float(r.total)
            for t in r.tickets:
                section_id = str(t.section_id)

                a["sections"][section_id] += 1
                a["section_revenue"][section_id] += float(t.unit_price)
    return {
        "reservation_count": len(rows),
        "confirmed_count": sum(r.status == "CONFIRMED" for r in rows),
        "total_revenue": round(
            sum(float(r.total) for r in rows if r.status == "CONFIRMED"), 2
        ),
        "by_status": {
            k: sum(r.status == k for r in rows)
            for k in ["PENDING", "CONFIRMED", "CANCELLED", "EXPIRED"]
        },
        "by_event": [
            {
                "event_id": k,
                "reservations": v["reservations"],
                "occupied": v["tickets"],
                "revenue": round(v["revenue"], 2),
                "by_section": dict(v["sections"]),
                "by_section_revenue": {
                    section_id: round(amount, 2)
                    for section_id, amount in v["section_revenue"].items()
                },
            }
            for k, v in totals.items()
        ],
    }
