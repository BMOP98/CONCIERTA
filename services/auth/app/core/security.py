"""CONCIERTA Auth: módulo separado sin cambiar las reglas originales."""

import os
import time
import threading
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.core.config import SECRET
from app.db.database import db
from app.models import User

LOGIN_WINDOW_SECONDS = 300
LOGIN_MAX_ATTEMPTS = 10
login_attempts = {}
login_lock = threading.Lock()
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth = OAuth2PasswordBearer(tokenUrl="/auth/token")


def check_login_rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()

    with login_lock:
        # Eliminar entradas de ventanas anteriores.
        expired = [
            ip
            for ip, entry in login_attempts.items()
            if now - entry["start"] >= LOGIN_WINDOW_SECONDS
        ]

        for ip in expired:
            del login_attempts[ip]

        entry = login_attempts.get(client_ip)

        if entry is None:
            login_attempts[client_ip] = {"start": now, "count": 1}
            return

        if entry["count"] >= LOGIN_MAX_ATTEMPTS:
            raise HTTPException(
                status_code=429,
                detail="Demasiados intentos de acceso. Intenta nuevamente en unos minutos.",
                headers={
                    "Retry-After": str(
                        max(1, int(LOGIN_WINDOW_SECONDS - (now - entry["start"])) + 1)
                    )
                },
            )

        entry["count"] += 1


def make_token(u):
    now = datetime.now(timezone.utc)

    return jwt.encode(
        {
            "sub": u.id,
            "role": u.role_id,
            "password_change_required": bool(u.must_change_password),
            "iat": int(now.timestamp()),
            "token_version": u.token_version,
            "exp": now + timedelta(hours=8),
        },
        SECRET,
        algorithm="HS256",
    )


def validate_token_version(payload, u):
    if payload.get("token_version") != u.token_version:
        raise HTTPException(401, "Sesión invalidada. Inicia sesión nuevamente")


def current(token: str = Depends(oauth), s: Session = Depends(db)):
    try:
        payload = jwt.decode(token, SECRET, algorithms=["HS256"])
        id = payload["sub"]
    except (JWTError, KeyError):
        raise HTTPException(401, "Token no válido")
    u = s.get(User, id)
    if not u or not u.active:
        raise HTTPException(401, "Usuario inactivo o inexistente")
    validate_token_version(payload, u)
    if u.must_change_password:
        raise HTTPException(403, "Debes cambiar tu contraseña antes de continuar")
    return u


def admin(u: User = Depends(current)):
    if u.role_id != "ADMIN":
        raise HTTPException(403, "Se requiere rol ADMIN")
    return u


def authenticated_allow_password_change(
    token: str = Depends(oauth), s: Session = Depends(db)
):
    try:
        payload = jwt.decode(token, SECRET, algorithms=["HS256"])
        uid = payload["sub"]

    except (JWTError, KeyError):
        raise HTTPException(401, "Token no válido")

    u = s.get(User, uid)

    if not u or not u.active:
        raise HTTPException(401, "Cuenta no disponible")

    validate_token_version(payload, u)

    return u
