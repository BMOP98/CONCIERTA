"""SQLAlchemy entities. Database schema is unchanged."""

import uuid, secrets
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Numeric, Index
from sqlalchemy.orm import relationship
from ..db.database import Base


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
