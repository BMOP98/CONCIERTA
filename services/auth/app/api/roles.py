"""CONCIERTA Auth: módulo separado sin cambiar las reglas originales."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.database import db
from app.models import Role, User
from app.schemas.auth import RoleInput, RoleEdit
from app.core.security import admin
from app.services.audit import write_audit

router = APIRouter()


@router.get("/auth/roles")
def roles(_: User = Depends(admin), s: Session = Depends(db)):
    return [
        {"id": r.id, "description": r.description}
        for r in s.scalars(select(Role)).all()
    ]


@router.post("/auth/roles", status_code=201)
def role_create(p: RoleInput, actor: User = Depends(admin), s: Session = Depends(db)):
    if s.get(Role, p.id):
        raise HTTPException(409, "Rol existente")

    s.add(Role(id=p.id, description=p.description))
    s.commit()

    write_audit(
        action="ROLE_CREATED",
        status="SUCCESS",
        user_id=actor.id,
        resource="ROLE",
        resource_id=p.id,
        details="Rol creado por un administrador",
    )

    return p.model_dump()


@router.put("/auth/roles/{rid}")
def role_update(
    rid: str, p: RoleEdit, actor: User = Depends(admin), s: Session = Depends(db)
):
    r = s.get(Role, rid)

    if not r:
        raise HTTPException(404, "Rol no encontrado")

    previous_description = r.description

    r.description = p.description
    s.commit()

    if previous_description != p.description:
        write_audit(
            action="ROLE_UPDATED",
            status="SUCCESS",
            user_id=actor.id,
            resource="ROLE",
            resource_id=rid,
            details="Descripción del rol modificada",
        )

    return {"id": rid, "description": p.description}


@router.delete("/auth/roles/{rid}")
def role_delete(rid: str, actor: User = Depends(admin), s: Session = Depends(db)):
    if rid in ("ADMIN", "CLIENTE"):
        raise HTTPException(409, "Los roles base son obligatorios")

    r = s.get(Role, rid)

    if not r:
        raise HTTPException(404, "Rol no encontrado")

    if s.scalar(select(User).where(User.role_id == rid)):
        raise HTTPException(409, "Rol asignado a usuarios")

    s.delete(r)
    s.commit()

    write_audit(
        action="ROLE_DELETED",
        status="SUCCESS",
        user_id=actor.id,
        resource="ROLE",
        resource_id=rid,
        details="Rol eliminado por un administrador",
    )

    return {"ok": True}
