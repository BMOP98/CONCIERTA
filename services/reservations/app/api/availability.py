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


@router.get("/availability/{event_id}")
async def availability(event_id: str, s: Session = Depends(db)):
    await event_info(event_id)
    venue = await catalog()
    expire(s)
    s.commit()
    rows = s.execute(
        text(
            "SELECT t.section_id,t.seat_id,t.seat_label,r.status FROM tickets t JOIN reservations r ON r.id=t.reservation_id WHERE t.event_id=:ev AND (r.status='CONFIRMED' OR (r.status='PENDING' AND r.expires_at>now()))"
        ),
        {"ev": event_id},
    ).all()
    taken = [
        {"section_id": a, "seat_id": b, "seat_label": c}
        for a, b, c, _ in rows
        if b is not None
    ]
    used = defaultdict(int)
    for section_id, seat_id, label, status in rows:
        used[section_id] += 1
    return {
        "taken": taken,
        "sections": [
            {
                "section_id": sec["id"],
                "capacity": sec["capacity"],
                "available": max(0, sec["capacity"] - used[sec["id"]]),
            }
            for sec in venue["Sections"]
        ],
    }
