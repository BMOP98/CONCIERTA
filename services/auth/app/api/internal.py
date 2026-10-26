"""CONCIERTA Auth: módulo separado sin cambiar las reglas originales."""

import secrets
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from app.db.database import db
from app.core.config import INTERNAL
from app.models import User

router = APIRouter()


@router.get("/internal/users/{uid}")
def internal_user(
    uid: str, x_internal_key: str = Header(default=""), s: Session = Depends(db)
):
    if not x_internal_key or not secrets.compare_digest(x_internal_key, INTERNAL):
        raise HTTPException(403, "No autorizado")
    u = s.get(User, uid)
    if not u:
        return {"exists": False}
    return {
        "exists": True,
        "active": u.active,
        "role": u.role_id,
        "email": u.email,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "must_change_password": bool(u.must_change_password),
        "token_version": u.token_version,
        "password_changed_at": (
            u.password_changed_at.isoformat() if u.password_changed_at else None
        ),
    }
