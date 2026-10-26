"""CONCIERTA Auth: módulo separado sin cambiar las reglas originales."""

import re
import secrets
import unicodedata
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.models import User
from app.schemas.auth import Registration
from app.core.security import pwd


def serialize(u):
    return {
        "id": u.id,
        "first_name": u.first_name,
        "second_name": u.second_name,
        "last_name": u.last_name,
        "dni": u.dni,
        "nationality": u.nationality,
        "address": u.address,
        "phone": u.phone,
        "email": u.email,
        "username": u.username,
        "role": u.role_id,
        "active": u.active,
        "last_login": u.last_login.isoformat() if u.last_login else None,
        "must_change_password": bool(u.must_change_password),
    }


def serialize_public(u):
    return {
        "id": u.id,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "username": u.username,
        "role": u.role_id,
        "active": u.active,
        "must_change_password": bool(u.must_change_password),
    }


def normalize_name(value: str) -> str:
    """Produce an ASCII username component from a human name."""
    value = unicodedata.normalize("NFKD", value.casefold())
    return re.sub("[^a-z]", "", value.encode("ascii", "ignore").decode())


def username_candidates(first_name: str, second_name: str, last_name: str):
    """Prefer readable, deterministic combinations; only add digits as last resort."""
    first = normalize_name(first_name)
    middle = normalize_name(second_name)
    surname_parts = [normalize_name(part) for part in last_name.split()]
    surname = "".join(surname_parts)
    if not first or not surname:
        raise HTTPException(
            422, "Indica nombres y apellidos válidos para generar el usuario"
        )
    candidates = [first[0] + surname]
    if middle:
        candidates += [first[0] + middle[0] + surname, first[0] + middle + surname]
    candidates += [first[:2] + surname, first[:3] + surname, first + surname]
    if middle:
        candidates += [first + middle[0] + surname, first + middle + surname]
    for part in surname_parts[1:]:
        candidates += [first[0] + part, first[0] + surname_parts[0] + part]
    seen = set()
    for candidate in candidates:
        if candidate not in seen:
            seen.add(candidate)
            yield candidate[:48]
    for number in range(1, 10000):
        yield f"{candidates[0][:42]}{number}"


def create_user(s: Session, p: Registration, role_id="CLIENTE"):
    email = str(p.email).lower().strip()
    dni = p.dni.strip()
    if s.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(
            409,
            "Este correo electrónico ya está registrado. Inicia sesión o utiliza otro correo.",
        )
    if s.scalar(select(User.id).where(User.dni == dni)):
        raise HTTPException(409, "Este documento de identidad ya está registrado.")
    temporary_password = secrets.token_urlsafe(15)
    for username in username_candidates(p.first_name, p.second_name, p.last_name):
        if s.scalar(select(User.id).where(User.username == username)):
            continue
        u = User(
            id=secrets.token_hex(16),
            first_name=p.first_name.strip(),
            second_name=p.second_name.strip(),
            last_name=p.last_name.strip(),
            dni=dni,
            nationality=p.nationality.strip(),
            address=p.address.strip(),
            phone=p.phone.strip(),
            email=email,
            username=username,
            password_hash=pwd.hash(temporary_password),
            role_id=role_id,
            active=True,
        )
        try:
            with s.begin_nested():
                s.add(u)
                s.flush()
            return (u, temporary_password)
        except IntegrityError:
            # Otro registro concurrente pudo haber reservado este nombre de usuario.
            if s.scalar(select(User.id).where(User.email == email)):
                raise HTTPException(409, "Este correo electrónico ya está registrado.")
            if s.scalar(select(User.id).where(User.dni == dni)):
                raise HTTPException(
                    409, "Este documento de identidad ya está registrado."
                )
    raise HTTPException(
        503, "No se pudo generar un nombre de usuario único. Intenta nuevamente."
    )
