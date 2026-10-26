"""Thirty-second expiration maintenance worker and DB initialization."""

import threading, logging
from sqlalchemy import text
from ..db.database import engine
from ..models.entities import Base, Reservation, Ticket, AuditLog

expiration_stop = threading.Event()
expiration_logger = logging.getLogger("concierta.expiration")


def initialize():
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS email_status VARCHAR DEFAULT 'PENDING' NOT NULL"
        )


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


def start_expiration_worker():

    expiration_stop.clear()

    worker = threading.Thread(
        target=expiration_worker, name="concierta-expiration-worker", daemon=True
    )

    worker.start()


def stop_expiration_worker():

    expiration_stop.set()
