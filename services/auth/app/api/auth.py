"""CONCIERTA Auth: módulo separado sin cambiar las reglas originales."""

import re
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.db.database import db
from app.models import User
from app.schemas.auth import Registration, Login, PasswordChange
from app.core.security import (
    check_login_rate_limit,
    authenticated_allow_password_change,
    pwd,
    make_token,
)
from app.services.users import create_user, serialize
from app.services.email import deliver_credentials
from app.services.session import issue
from app.services.audit import write_audit

router = APIRouter()


@router.post("/auth/register", status_code=201)
def register(p: Registration, s: Session = Depends(db)):
    u, password = create_user(s, p)
    try:
        deliver_credentials(u.email, u.username, password)
        s.commit()
    except Exception:
        s.rollback()
        raise
    return {
        "message": "Cuenta creada correctamente. Hemos enviado tus credenciales a tu correo electrónico."
    }


@router.post("/auth/login")
def login(p: Login, request: Request, s: Session = Depends(db)):
    check_login_rate_limit(request)
    return issue(p.username, p.password, s)


@router.post("/auth/token")
def token(
    request: Request, p: OAuth2PasswordRequestForm = Depends(), s: Session = Depends(db)
):
    check_login_rate_limit(request)
    if not 1 <= len(p.username) <= 254 or not 1 <= len(p.password) <= 128:
        raise HTTPException(422, "Longitud de credenciales inválida")

    return issue(p.username, p.password, s)


@router.get("/auth/me")
def me(u: User = Depends(authenticated_allow_password_change)):
    return serialize(u)


@router.put("/auth/password")
def password(
    p: PasswordChange,
    u: User = Depends(authenticated_allow_password_change),
    s: Session = Depends(db),
):
    if not pwd.verify(p.current_password, u.password_hash):
        raise HTTPException(400, "Contraseña actual incorrecta")
    if pwd.verify(p.new_password, u.password_hash):
        raise HTTPException(400, "La nueva contraseña debe ser diferente")
    if (
        not re.search("[A-Z]", p.new_password)
        or not re.search("[a-z]", p.new_password)
        or (not re.search("[0-9]", p.new_password))
    ):
        raise HTTPException(
            400, "La contraseña debe incluir mayúsculas, minúsculas y números"
        )
    u.password_hash = pwd.hash(p.new_password)
    u.must_change_password = False
    u.password_changed_at = datetime.now(timezone.utc)
    u.token_version += 1
    s.commit()
    write_audit(
        action="PASSWORD_CHANGED",
        status="SUCCESS",
        user_id=u.id,
        resource="USER",
        resource_id=u.id,
        details="El usuario cambió su contraseña",
    )
    return {"ok": True, "access_token": make_token(u), "user": serialize(u)}
