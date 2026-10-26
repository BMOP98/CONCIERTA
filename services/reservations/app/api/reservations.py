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


@router.post("/reservations", status_code=201)
async def create(p: ReserveIn, u=Depends(user), s: Session = Depends(db)):
    ev = await event_info(p.event_id)
    if (
        not ev.get("active")
        or datetime.fromisoformat(ev["date"].replace("Z", "+00:00")) <= utcnow()
    ):
        raise HTTPException(400, "Evento no disponible para reservas")
    venue = await catalog()
    sections = {x["id"]: x for x in venue["Sections"]}
    wanted = []
    for item in p.items:
        sec = sections.get(item.section_id)
        if not sec:
            raise HTTPException(400, "Sección inexistente")
        if sec["type"] == "CANCHA":
            if item.seat_id is not None:
                raise HTTPException(400, "CANCHA no tiene asiento numerado")
            wanted.extend([(sec, None, None, float(sec["price"]))] * item.quantity)
        else:
            if item.quantity != 1 or item.seat_id is None:
                raise HTTPException(
                    400, "Seleccione cada asiento numerado individualmente"
                )
            seat = next((a for a in sec["Seats"] if a["id"] == item.seat_id), None)
            if not seat:
                raise HTTPException(400, "Asiento no pertenece a la sección")
            wanted.append((sec, item.seat_id, seat["label"], float(sec["price"])))
    if not 1 <= len(wanted) <= 6:
        raise HTTPException(400, "Máximo seis entradas por operación")
    ids = [x[1] for x in wanted if x[1] is not None]
    if len(ids) != len(set(ids)):
        raise HTTPException(400, "Asientos duplicados")
    # Serialize competing bookings for same event with transaction-scoped advisory lock.
    s.execute(text("SELECT pg_advisory_xact_lock(hashtext(:id))"), {"id": p.event_id})
    expire(s)
    existing = s.execute(
        text(
            "SELECT count(*) FROM tickets t JOIN reservations r ON r.id=t.reservation_id WHERE r.client_id=:client AND r.event_id=:ev AND (r.status='CONFIRMED' OR (r.status='PENDING' AND r.expires_at>now()))"
        ),
        {"client": u["sub"], "ev": p.event_id},
    ).scalar_one()
    if existing + len(wanted) > 6:
        raise HTTPException(409, "Máximo 6 entradas por cliente y evento")
    occ = s.execute(
        text(
            "SELECT t.section_id,t.seat_id FROM tickets t JOIN reservations r ON r.id=t.reservation_id WHERE t.event_id=:ev AND (r.status='CONFIRMED' OR (r.status='PENDING' AND r.expires_at>now()))"
        ),
        {"ev": p.event_id},
    ).all()
    occupied = {seat for _, seat in occ if seat is not None}
    counts = defaultdict(int)
    for sec_id, seat in occ:
        counts[sec_id] += 1
    for sec, seat, _, price in wanted:
        if seat is not None and seat in occupied:
            raise HTTPException(409, "Un asiento seleccionado ya está ocupado")
        counts[sec["id"]] += 1
        if counts[sec["id"]] > sec["capacity"]:
            raise HTTPException(409, "La sección no tiene cupos suficientes")
    r = Reservation(
        code="CON-" + secrets.token_hex(5).upper(),
        client_id=u["sub"],
        event_id=p.event_id,
        expires_at=utcnow() + timedelta(minutes=int(os.getenv("HOLD_MINUTES", "5"))),
        total=round(sum(v[3] for v in wanted), 2),
    )
    s.add(r)
    s.flush()
    for sec, seat, label, price in wanted:
        if seat is None:
            n = (
                s.execute(
                    text(
                        "SELECT count(*) FROM tickets WHERE event_id=:ev AND section_id=:sec"
                    ),
                    {"ev": p.event_id, "sec": sec["id"]},
                ).scalar_one()
                + 1
            )
            label = "CANCHA-" + str(n)
        s.add(
            Ticket(
                reservation_id=r.id,
                event_id=p.event_id,
                section_id=sec["id"],
                seat_id=seat,
                seat_label=label,
                unit_price=price,
            )
        )
    s.commit()
    s.refresh(r)

    write_audit(
        action="RESERVATION_CREATED",
        status="SUCCESS",
        user_id=u["sub"],
        resource="RESERVATION",
        resource_id=r.id,
        details=f"Reserva {r.code} creada para el evento {r.event_id}",
    )

    return asdict(r)


@router.post("/reservations/{rid}/confirm")
def confirm(
    rid: str,
    background_tasks: BackgroundTasks,
    u=Depends(user),
    s: Session = Depends(db),
):
    r = s.get(Reservation, rid)
    if not r or (r.client_id != u["sub"] and u.get("role") != "ADMIN"):
        raise HTTPException(404, "Reserva no encontrada")
    s.execute(text("SELECT pg_advisory_xact_lock(hashtext(:id))"), {"id": r.event_id})
    s.refresh(r)
    if r.status != "PENDING":
        raise HTTPException(409, "La reserva no está pendiente")
    if r.expires_at <= utcnow():
        r.status = "EXPIRED"
        s.commit()
        raise HTTPException(409, "Tiempo de confirmación agotado")
    r.status = "CONFIRMED"
    r.confirmed_at = utcnow()
    r.email_status = "PENDING"
    s.commit()

    write_audit(
        action="RESERVATION_CONFIRMED",
        status="SUCCESS",
        user_id=u["sub"],
        resource="RESERVATION",
        resource_id=r.id,
        details=f"Reserva {r.code} confirmada",
    )

    background_tasks.add_task(email_confirmation_job, r.id)
    return asdict(r)


@router.post("/reservations/{rid}/resend-email")
def resend_email(
    rid: str,
    background_tasks: BackgroundTasks,
    u=Depends(user),
    s: Session = Depends(db),
):
    r = s.get(Reservation, rid)
    if not r or r.client_id != u["sub"] or r.status != "CONFIRMED":
        raise HTTPException(404, "Reserva no encontrada")
    if r.email_status == "SENT":
        raise HTTPException(409, "El correo ya fue enviado")
    r.email_status = "PENDING"
    s.commit()
    background_tasks.add_task(email_confirmation_job, r.id)
    return {"message": "Se ha programado un nuevo intento de envío"}


@router.post("/reservations/{rid}/cancel")
def cancel(rid: str, u=Depends(user), s: Session = Depends(db)):
    r = s.get(Reservation, rid)
    if not r or (r.client_id != u["sub"] and u.get("role") != "ADMIN"):
        raise HTTPException(404, "Reserva no encontrada")
    if r.status not in ("PENDING", "CONFIRMED"):
        raise HTTPException(409, "No se puede cancelar")
    r.status = "CANCELLED"
    s.commit()

    write_audit(
        action="RESERVATION_CANCELLED",
        status="SUCCESS",
        user_id=u["sub"],
        resource="RESERVATION",
        resource_id=r.id,
        details=f"Reserva {r.code} cancelada",
    )

    return asdict(r)


@router.get("/reservations/mine")
def mine(
    from_date: str | None = None,
    to_date: str | None = None,
    u=Depends(user),
    s: Session = Depends(db),
):
    expire(s)
    s.commit()
    q = (
        select(Reservation)
        .where(Reservation.client_id == u["sub"])
        .order_by(Reservation.created_at.desc())
    )
    if from_date:
        q = q.where(
            Reservation.created_at
            >= datetime.fromisoformat(from_date).replace(tzinfo=timezone.utc)
        )
    if to_date:
        q = q.where(
            Reservation.created_at
            <= datetime.fromisoformat(to_date).replace(tzinfo=timezone.utc)
            + timedelta(days=1)
        )
    return [asdict(r) for r in s.scalars(q).all()]


@router.get("/reservations/all")
def all_reservations(_: dict = Depends(admin), s: Session = Depends(db)):
    expire(s)
    s.commit()
    return [
        asdict(r)
        for r in s.scalars(
            select(Reservation).order_by(Reservation.created_at.desc())
        ).all()
    ]
