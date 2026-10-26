"""CONCIERTA Auth: módulo separado sin cambiar las reglas originales."""

import os
import secrets
from sqlalchemy import select
from app.db.database import Base, engine, SessionLocal
from app.models import User, Role, AuditLog
from app.core.security import pwd


def init():
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ"
        )
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0"
        )
    with SessionLocal() as s:
        for id in ["ADMIN", "CLIENTE"]:
            if not s.get(Role, id):
                s.add(Role(id=id, description=id.title()))
        if not s.scalar(select(User).where(User.role_id == "ADMIN")):
            s.add(
                User(
                    id=secrets.token_hex(16),
                    first_name="Administrador",
                    second_name="",
                    last_name="Concierta",
                    dni="ADMIN-001",
                    nationality="Ecuatoriana",
                    address="Oficina central",
                    phone="0999999999",
                    email=os.getenv("ADMIN_EMAIL", "admin@concierta.ec"),
                    username="admin",
                    password_hash=pwd.hash(os.environ["ADMIN_PASSWORD"]),
                    role_id="ADMIN",
                    active=True,
                    must_change_password=True,
                )
            )
        s.commit()
