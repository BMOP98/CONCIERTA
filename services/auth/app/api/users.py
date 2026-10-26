"""CONCIERTA Auth: módulo separado sin cambiar las reglas originales."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.database import db
from app.models import User, Role
from app.schemas.auth import UserUpdate, AdminRegistration
from app.core.security import admin
from app.services.users import create_user, serialize
from app.services.email import deliver_credentials
from app.services.audit import write_audit

router = APIRouter()


@router.get("/auth/users")
def users(_: User = Depends(admin), s: Session = Depends(db)):
    return [
        serialize(u)
        for u in s.scalars(select(User).order_by(User.created_at.desc())).all()
    ]


@router.patch("/auth/users/{uid}")
def update(
    uid: str, p: UserUpdate, actor: User = Depends(admin), s: Session = Depends(db)
):
    u = s.get(User, uid)
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    previous_role = u.role_id
    previous_active = u.active
    if uid == actor.id and p.active is False:
        raise HTTPException(400, "No puedes desactivarte")
    if uid == actor.id and p.role_id is not None and p.role_id != "ADMIN":
        raise HTTPException(400, "No puedes quitarte tu propio rol de administrador")
    if p.active is not None:
        u.active = p.active
    if p.role_id is not None:
        if not s.get(Role, p.role_id):
            raise HTTPException(400, "Rol desconocido")
        u.role_id = p.role_id
    s.commit()
    changes = []

    if previous_role != u.role_id:
        changes.append(f"Rol: {previous_role} -> {u.role_id}")

    if previous_active != u.active:
        changes.append(f"Activo: {previous_active} -> {u.active}")

    if changes:
        write_audit(
            action="USER_UPDATED",
            status="SUCCESS",
            user_id=actor.id,
            resource="USER",
            resource_id=u.id,
            details="; ".join(changes),
        )
    return serialize(u)


@router.post("/auth/users", status_code=201)
def admin_create(
    p: AdminRegistration, actor: User = Depends(admin), s: Session = Depends(db)
):
    if p.role_id not in ("ADMIN", "CLIENTE"):
        raise HTTPException(400, "Rol no permitido")

    u, temporary = create_user(s, p, p.role_id)

    try:
        deliver_credentials(u.email, u.username, temporary)
        s.commit()
    except Exception:
        s.rollback()
        raise

    write_audit(
        action="USER_CREATED",
        status="SUCCESS",
        user_id=actor.id,
        resource="USER",
        resource_id=u.id,
        details=f"Usuario creado con rol {u.role_id}",
    )

    return {
        "message": "Usuario creado. Se enviaron sus credenciales al correo registrado.",
        "user": serialize(u),
    }


@router.delete("/auth/users/{uid}")
def deactivate(uid: str, actor: User = Depends(admin), s: Session = Depends(db)):
    if uid == actor.id:
        raise HTTPException(400, "No puedes eliminarte")
    u = s.get(User, uid)
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    was_active = u.active

    u.active = False
    s.commit()

    if was_active:
        write_audit(
            action="USER_DEACTIVATED",
            status="SUCCESS",
            user_id=actor.id,
            resource="USER",
            resource_id=u.id,
            details="Cuenta desactivada por un administrador",
        )

    return {"message": "Usuario desactivado (baja lógica)"}
