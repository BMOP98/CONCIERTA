"""CONCIERTA Auth: módulo separado sin cambiar las reglas originales."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Integer
from app.db.database import Base


class Role(Base):
    __tablename__ = "roles"
    id = Column(String, primary_key=True)
    description = Column(String, nullable=False)


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    first_name = Column(String, nullable=False)
    second_name = Column(String, nullable=False, default="")
    last_name = Column(String, nullable=False)
    dni = Column(String, unique=True, nullable=False)
    nationality = Column(String, nullable=False)
    address = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role_id = Column(String, ForeignKey("roles.id"), nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    must_change_password = Column(Boolean, default=True, nullable=False)
    password_changed_at = Column(DateTime(timezone=True), nullable=True)
    token_version = Column(Integer, nullable=False, default=0, server_default="0")


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
