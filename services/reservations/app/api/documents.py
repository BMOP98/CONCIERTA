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


async def reservation_documents(rid, u, s):
    r = s.get(Reservation, rid)
    if (
        not r
        or (r.client_id != u["sub"] and u.get("role") != "ADMIN")
        or r.status != "CONFIRMED"
    ):
        raise HTTPException(404, "Documento no disponible")
    ev = await event_info(r.event_id)
    venue = await catalog()
    return r, ev, {x["id"]: x for x in venue["Sections"]}


@router.get("/reservations/{rid}/summary.pdf")
async def download_summary(rid: str, u=Depends(user), s: Session = Depends(db)):
    r, ev, secs = await reservation_documents(rid, u, s)
    return Response(
        summary_pdf(r, ev, secs),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="CONCIERTA-{r.code}-resumen.pdf"'
        },
    )


@router.get("/tickets/{tid}/ticket.pdf")
async def download_ticket(tid: str, u=Depends(user), s: Session = Depends(db)):
    t = s.get(Ticket, tid)
    if not t:
        raise HTTPException(404, "Boleto no encontrado")
    r, ev, secs = await reservation_documents(t.reservation_id, u, s)
    return Response(
        ticket_pdf(r, t, ev, secs.get(t.section_id, {})),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="CONCIERTA-{r.code}-{t.id[:8]}.pdf"'
        },
    )
