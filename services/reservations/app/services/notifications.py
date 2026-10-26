"""Background email confirmation delivery."""

import os, httpx
from ..core.config import INTERNAL
from ..db.database import SessionLocal
from ..models.entities import Reservation
from ..documents import send_confirmation


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
