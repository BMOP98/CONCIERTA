import os, uuid, secrets, io, base64
import threading
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[3] / ".env")
import httpx, qrcode
from .documents import ticket_pdf, summary_pdf, send_confirmation
from fastapi import FastAPI, Depends, HTTPException, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import Response
from jose import jwt, JWTError
from pydantic import BaseModel, Field
from sqlalchemy import (
    create_engine,
    Column,
    String,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    UniqueConstraint,
    select,
    func,
    text,
    Index,
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session, relationship

SECRET = os.getenv("JWT_SECRET", "").strip()
INTERNAL = os.getenv("INTERNAL_SECRET", "").strip()

if len(SECRET) < 32:
    raise RuntimeError("JWT_SECRET no configurado correctamente")

if len(INTERNAL) < 32:
    raise RuntimeError("INTERNAL_SECRET no configurado correctamente")
DATABASE_NAME = os.getenv("DATABASE_NAME", "concierta_reservations")

URL = (
    f"postgresql+psycopg://"
    f"{os.getenv('DATABASE_USER', 'concierta')}:"
    f"{os.getenv('DATABASE_PASSWORD')}@"
    f"{os.getenv('DATABASE_HOST', 'localhost')}:"
    f"{os.getenv('DATABASE_PORT', '5434')}/"
    f"{DATABASE_NAME}"
)
engine = create_engine(URL, pool_pre_ping=True)
SessionLocal = sessionmaker(engine)


class Base(DeclarativeBase):
    pass


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    code = Column(String, unique=True, nullable=False)
    client_id = Column(String, nullable=False, index=True)
    event_id = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default="PENDING")

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    expires_at = Column(DateTime(timezone=True), nullable=False)
    confirmed_at = Column(DateTime(timezone=True))

    total = Column(Numeric(12, 2), nullable=False, default=0)

    email_status = Column(
        String, nullable=False, default="PENDING", server_default="PENDING"
    )

    tickets = relationship(
        "Ticket", back_populates="reservation", cascade="all, delete-orphan"
    )


class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    reservation_id = Column(
        String, ForeignKey("reservations.id"), nullable=False, index=True
    )
    event_id = Column(String, nullable=False, index=True)
    section_id = Column(Integer, nullable=False)
    seat_id = Column(Integer, nullable=True)
    seat_label = Column(String, nullable=False)
    qr_secret = Column(
        String, unique=True, nullable=False, default=lambda: secrets.token_urlsafe(24)
    )
    unit_price = Column(Numeric(12, 2), nullable=False)
    validated_at = Column(DateTime(timezone=True), nullable=True)
    reservation = relationship("Reservation", back_populates="tickets")


Index("idx_ticket_event_seat", Ticket.event_id, Ticket.seat_id)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    user_id = Column(String, nullable=True, index=True)
    action = Column(String(100), nullable=False)
    resource = Column(String(100), nullable=True)
    resource_id = Column(String, nullable=True)
    status = Column(String(20), nullable=False)
    details = Column(String(1000), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class Item(BaseModel):
    section_id: int = Field(gt=0)
    seat_id: int | None = None
    quantity: int = Field(default=1, ge=1, le=6)


class ReserveIn(BaseModel):
    event_id: str
    items: list[Item] = Field(min_length=1, max_length=6)


class ValidateIn(BaseModel):
    qr_secret: str


app = FastAPI(title="Concierta · Reservas", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("CORS_ORIGIN", "http://localhost:5173"),
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
oauth = OAuth2PasswordBearer(tokenUrl="/auth/token")


def db():
    with SessionLocal() as s:
        yield s


def user(token: str = Depends(oauth)):
    try:
        claims = jwt.decode(token, SECRET, algorithms=["HS256"])
        uid = claims["sub"]
    except (JWTError, KeyError):
        raise HTTPException(401, "Token inválido")

    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.get(
                os.getenv("AUTH_URL", "http://localhost:8001")
                + "/internal/users/"
                + uid,
                headers={"x-internal-key": INTERNAL},
            )
            response.raise_for_status()
            account = response.json()

    except (httpx.RequestError, httpx.HTTPStatusError, ValueError):
        raise HTTPException(503, "No se pudo verificar la cuenta con Autenticación")

    if not account.get("exists") or not account.get("active"):
        raise HTTPException(401, "Cuenta inexistente o desactivada")

    if account.get("must_change_password"):
        raise HTTPException(403, "Debes cambiar tu contraseña antes de continuar")

    # El rol válido es el actual en la base de datos,
    # no necesariamente el que figura en el JWT.
    if type(claims.get("token_version")) is not int or claims[
        "token_version"
    ] != account.get("token_version"):
        raise HTTPException(401, "Sesión invalidada. Inicia sesión nuevamente")
    claims["role"] = account["role"]

    return claims


def internal(x_internal_key: str = Header(default="")):
    if not secrets.compare_digest(x_internal_key, INTERNAL):
        raise HTTPException(403, "Acceso interno denegado")


def admin(u=Depends(user)):
    if u.get("role") != "ADMIN":
        raise HTTPException(403, "Se requiere ADMIN")
    return u


def write_audit(
    action, status, user_id=None, resource=None, resource_id=None, details=None
):
    try:
        with SessionLocal() as session:
            session.add(
                AuditLog(
                    user_id=user_id,
                    action=action,
                    resource=resource,
                    resource_id=resource_id,
                    status=status,
                    details=details,
                )
            )
            session.commit()

    except Exception:
        logging.getLogger("concierta.audit").exception(
            "No se pudo registrar la auditoría: %s", action
        )


def utcnow():
    return datetime.now(timezone.utc)


def expire(s):
    s.execute(
        text(
            "UPDATE reservations SET status='EXPIRED' WHERE status='PENDING' AND expires_at <= now()"
        )
    )


def asdict(r):
    return {
        "id": r.id,
        "code": r.code,
        "client_id": r.client_id,
        "event_id": r.event_id,
        "status": r.status,
        "total": float(r.total),
        "email_status": r.email_status,
        "created_at": r.created_at.isoformat(),
        "expires_at": r.expires_at.isoformat(),
        "tickets": [
            {
                "id": t.id,
                "section_id": t.section_id,
                "seat_id": t.seat_id,
                "seat_label": t.seat_label,
                "unit_price": float(t.unit_price),
                "validated_at": t.validated_at.isoformat() if t.validated_at else None,
            }
            for t in r.tickets
        ],
    }


async def catalog():
    async with httpx.AsyncClient(timeout=10) as h:
        try:
            a = await h.get(
                os.getenv("EVENTS_URL", "http://localhost:8002") + "/scenario"
            )
            a.raise_for_status()
            return a.json()[0]
        except Exception:
            raise HTTPException(503, "Servicio de escenarios no disponible")


async def event_info(id):
    async with httpx.AsyncClient(timeout=10) as h:
        try:
            r = await h.get(
                os.getenv("EVENTS_URL", "http://localhost:8002") + "/events/" + id
            )
            if r.status_code == 404:
                raise HTTPException(404, "Evento no encontrado")
            r.raise_for_status()
            return r.json()
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(503, "Servicio de eventos no disponible")


@app.on_event("startup")
def initialize():
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS email_status VARCHAR DEFAULT 'PENDING' NOT NULL"
        )


# ============================================================
# EXPIRACION AUTOMATICA DE RESERVAS
# ============================================================

expiration_stop = threading.Event()

expiration_logger = logging.getLogger("concierta.expiration")


def expiration_worker():
    """
    Revisa periódicamente las reservas vencidas.
    Libera su disponibilidad cambiando PENDING a EXPIRED.
    """

    while not expiration_stop.is_set():
        try:
            with engine.begin() as connection:

                result = connection.execute(text("""
                        UPDATE reservations
                        SET status = 'EXPIRED'
                        WHERE status = 'PENDING'
                          AND expires_at <= NOW()
                    """))

                expired_count = result.rowcount

                if expired_count > 0:
                    expiration_logger.info(
                        "Reservas expiradas automáticamente: %s", expired_count
                    )

        except Exception:
            expiration_logger.exception("Error durante la expiración automática")

        # Revisar nuevamente cada 30 segundos.
        expiration_stop.wait(30)


@app.on_event("startup")
def start_expiration_worker():

    expiration_stop.clear()

    worker = threading.Thread(
        target=expiration_worker, name="concierta-expiration-worker", daemon=True
    )

    worker.start()


@app.on_event("shutdown")
def stop_expiration_worker():

    expiration_stop.set()


@app.get("/health")
def health():
    return {"status": "ok", "service": "reservations"}


@app.get("/availability/{event_id}")
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


@app.post("/reservations", status_code=201)
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


def email_confirmation_job(reservation_id):
    """Background delivery is best-effort; failures remain visible and can be retried."""
    with SessionLocal() as s:
        r = s.get(Reservation, reservation_id)
        if not r or r.status != "CONFIRMED":
            return
        try:
            with httpx.Client(timeout=12) as client:
                resp = client.get(
                    os.getenv("AUTH_URL", "http://localhost:8001")
                    + "/internal/users/"
                    + r.client_id,
                    headers={"x-internal-key": INTERNAL},
                )
                resp.raise_for_status()
                person = resp.json()
                if not person.get("exists"):
                    raise RuntimeError("Cliente no encontrado")
                ev = client.get(
                    os.getenv("EVENTS_URL", "http://localhost:8002")
                    + "/events/"
                    + r.event_id
                )
                ev.raise_for_status()
                venue = client.get(
                    os.getenv("EVENTS_URL", "http://localhost:8002") + "/scenario"
                )
                venue.raise_for_status()
            sections = {x["id"]: x for x in venue.json()[0]["Sections"]}
            send_confirmation(
                person["email"], person["first_name"], r, ev.json(), sections
            )
            r.email_status = "SENT"
        except Exception as exc:
            import logging

            logging.getLogger("concierta.email").exception(
                "Error enviando confirmación reserva %s: %s", r.code, type(exc).__name__
            )
            r.email_status = "FAILED"
        s.commit()


@app.post("/reservations/{rid}/confirm")
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


@app.post("/reservations/{rid}/resend-email")
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


@app.get("/reservations/{rid}/summary.pdf")
async def download_summary(rid: str, u=Depends(user), s: Session = Depends(db)):
    r, ev, secs = await reservation_documents(rid, u, s)
    return Response(
        summary_pdf(r, ev, secs),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="CONCIERTA-{r.code}-resumen.pdf"'
        },
    )


@app.get("/tickets/{tid}/ticket.pdf")
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


@app.post("/reservations/{rid}/cancel")
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


@app.get("/reservations/mine")
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


@app.get("/reservations/all")
def all_reservations(_: dict = Depends(admin), s: Session = Depends(db)):
    expire(s)
    s.commit()
    return [
        asdict(r)
        for r in s.scalars(
            select(Reservation).order_by(Reservation.created_at.desc())
        ).all()
    ]


@app.get("/tickets/{tid}/qr")
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


@app.post("/tickets/{tid}/validate")
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


@app.get("/internal/report", dependencies=[Depends(internal)])
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
