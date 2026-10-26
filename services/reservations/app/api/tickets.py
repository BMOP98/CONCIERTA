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


@router.get("/tickets/{tid}/qr")
def qr(tid: str, u=Depends(user), s: Session = Depends(db)):
    t = s.get(Ticket, tid)
    if (
        not t
        or (t.reservation.client_id != u["sub"] and u.get("role") != "ADMIN")
        or t.reservation.status != "CONFIRMED"
    ):
        raise HTTPException(404, "Ticket no disponible")
    qr = qrcode.make(f"CONCIERTA:{t.id}:{t.qr_secret}")
    b = io.BytesIO()
    qr.save(b, format="PNG")
    return Response(content=b.getvalue(), media_type="image/png")


@router.post("/tickets/{tid}/validate")
def validate(tid: str, p: ValidateIn, actor=Depends(admin), s: Session = Depends(db)):
    t = s.get(Ticket, tid)
    if (
        not t
        or not secrets.compare_digest(t.qr_secret, p.qr_secret)
        or t.reservation.status != "CONFIRMED"
    ):
        raise HTTPException(400, "Ticket inválido")
    if t.validated_at:
        raise HTTPException(409, "Ticket ya utilizado")
    t.validated_at = utcnow()
    s.commit()

    write_audit(
        action="TICKET_VALIDATED",
        status="SUCCESS",
        user_id=actor["sub"],
        resource="TICKET",
        resource_id=t.id,
        details=f"Boleto validado para la reserva {t.reservation.code}",
    )

    return {"valid": True, "ticket_id": tid}
