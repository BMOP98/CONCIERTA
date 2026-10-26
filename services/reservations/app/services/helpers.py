"""Shared auditing, availability, serialization and interservice lookups."""

import os, logging
from datetime import datetime, timezone
import httpx
from fastapi import HTTPException
from sqlalchemy import text
from ..db.database import SessionLocal
from ..models.entities import AuditLog


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
