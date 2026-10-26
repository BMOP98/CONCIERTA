"""CONCIERTA Auth: módulo separado sin cambiar las reglas originales."""

from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import select
from app.models import User
from app.core.security import pwd, make_token
from app.services.users import serialize_public
from app.services.audit import write_audit


def issue(username, password, s):
    u = s.scalar(
        select(User).where(
            (User.username == username) | (User.email == username.lower())
        )
    )
    if not u or not u.active or not pwd.verify(password, u.password_hash):

        write_audit(
            action="LOGIN_FAILED",
            status="FAILED",
            user_id=u.id if u else None,
            resource="AUTH",
            resource_id=u.id if u else None,
            details="Intento de inicio de sesión rechazado",
        )

        raise HTTPException(401, "Credenciales incorrectas")
    u.last_login = datetime.now(timezone.utc)
    s.commit()

    write_audit(
        action="LOGIN_SUCCESS",
        status="SUCCESS",
        user_id=u.id,
        resource="AUTH",
        resource_id=u.id,
        details="Inicio de sesión exitoso",
    )

    return {
        "access_token": make_token(u),
        "token_type": "bearer",
        "user": serialize_public(u),
    }
