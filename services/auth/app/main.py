import os, re, secrets, unicodedata, smtplib, ssl
import uuid
import time
import threading
from email.message import EmailMessage
from html import escape
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[3] / ".env")
from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import (
    create_engine,
    Column,
    String,
    DateTime,
    Boolean,
    ForeignKey,
    Integer,
    select,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

SECRET = os.getenv("JWT_SECRET", "").strip()
INTERNAL = os.getenv("INTERNAL_SECRET", "").strip()

if len(SECRET) < 32:
    raise RuntimeError(
        "JWT_SECRET debe estar configurado y tener al menos 32 caracteres"
    )

if len(INTERNAL) < 32:
    raise RuntimeError(
        "INTERNAL_SECRET debe estar configurado y tener al menos 32 caracteres"
    )
URL = f"postgresql+psycopg://{os.getenv('DATABASE_USER', 'concierta')}:{os.getenv('DATABASE_PASSWORD', 'concierta_local_change_me')}@{os.getenv('DATABASE_HOST', 'localhost')}:{os.getenv('DATABASE_PORT', '5434')}/concierta_auth"
engine = create_engine(URL, pool_pre_ping=True)
SessionLocal = sessionmaker(engine)


class Base(DeclarativeBase):
    pass


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


def write_audit(
    action, status, user_id=None, resource=None, resource_id=None, details=None
):
    try:
        with SessionLocal() as session:
            session.add(
                AuditLog(
                    user_id=user_id,
                    action=action,
                    resource=resource,
                    resource_id=resource_id,
                    status=status,
                    details=details,
                )
            )
            session.commit()

    except Exception:
        import logging

        logging.getLogger("concierta.audit").exception(
            "No se pudo registrar la auditoría: %s", action
        )


# Protección básica contra intentos masivos de inicio de sesión.
LOGIN_WINDOW_SECONDS = 300
LOGIN_MAX_ATTEMPTS = 10

login_attempts = {}
login_lock = threading.Lock()


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


pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
app = FastAPI(title="Concierta · Autenticación", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("CORS_ORIGIN", "http://localhost:5173"),
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
oauth = OAuth2PasswordBearer(tokenUrl="/auth/token")


def db():
    with SessionLocal() as s:
        yield s


class Registration(BaseModel):
    first_name: str = Field(min_length=2, max_length=80)
    second_name: str = ""
    last_name: str = Field(min_length=2, max_length=80)
    dni: str = Field(min_length=5, max_length=30, pattern=r"^[A-Za-z0-9-]+$")
    nationality: str = Field(default="Ecuatoriana", min_length=2, max_length=60)
    address: str = Field(min_length=4, max_length=200)
    phone: str = Field(
        min_length=7, max_length=30, pattern=r"^\+?[0-9][0-9 ()-]{5,28}[0-9]$"
    )
    email: EmailStr


class Login(BaseModel):
    username: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class UserUpdate(BaseModel):
    active: Optional[bool] = None
    role_id: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10, max_length=128)


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


def deliver_credentials(email: str, username: str, password: str):
    """Send credentials via Gmail. No console fallback and no secrets in API responses."""
    if os.getenv("MAIL_MODE", "smtp").lower() != "smtp":
        raise HTTPException(
            503,
            "El registro requiere el servicio de correo SMTP. Configura MAIL_MODE=smtp.",
        )
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "465"))
    secure = os.getenv("SMTP_SECURE", "true").lower() == "true"
    sender = os.getenv("SMTP_FROM") or os.getenv("SMTP_USER")
    username_smtp = os.getenv("SMTP_USER")
    secret = os.getenv("SMTP_APP_PASSWORD")
    if not all((sender, username_smtp, secret)):
        raise HTTPException(
            503, "El servicio de correo no está configurado. Contacta al administrador."
        )
    msg = EmailMessage()
    msg["Subject"] = "CONCIERTA | Bienvenido, tus credenciales de acceso"
    msg["From"] = sender
    msg["To"] = email
    msg.set_content(
        f"¡Bienvenido/a a CONCIERTA!\n\nTu cuenta ha sido creada correctamente.\n\nUsuario: {username}\nContraseña temporal: {password}\n\nInicia sesión con estos datos. Por seguridad, cambia tu contraseña después del primer acceso.\n\nSi no solicitaste esta cuenta, puedes ignorar este correo y contactar al administrador.\nEquipo CONCIERTA\n"
    )
    msg.add_alternative(
        f'<html><body style="margin:0;background:#100c1b;padding:34px;font-family:Arial,sans-serif"><table role="presentation" style="max-width:580px;margin:auto;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="background:#24123e;padding:30px;color:white;font-size:26px;font-weight:bold">CONCIERTA <span style="color:#ee68bf">●</span></td></tr><tr><td style="padding:36px;color:#281b3b"><p style="color:#9b329f;font-weight:bold">BIENVENIDO A CONCIERTA</p><h1 style="font-size:26px">Tu cuenta está lista.</h1><p>Para acceder por primera vez utiliza estas credenciales:</p><div style="background:#f5effa;padding:20px;border-radius:10px"><p><b>Usuario:</b> {escape(username)}</p><p><b>Contraseña temporal:</b> {escape(password)}</p></div><p>Al iniciar sesión tendrás que establecer tu propia contraseña. La contraseña temporal dejará de funcionar después del cambio.</p><p style="color:#716581;font-size:12px">Si no solicitaste esta cuenta, contacta al administrador. No compartas tus credenciales.</p></td></tr><tr><td style="background:#f6f1fa;padding:20px;text-align:center;color:#716581;font-size:12px">CONCIERTA · Acceso seguro a experiencias en vivo</td></tr></table></body></html>',
        subtype="html",
    )
    try:
        if secure:
            with smtplib.SMTP_SSL(
                host, port, context=ssl.create_default_context(), timeout=15
            ) as smtp:
                smtp.login(username_smtp, secret)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                smtp.login(username_smtp, secret)
                smtp.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        print(
            f"[SMTP] No se pudo entregar el correo a {email}: {type(exc).__name__}",
            flush=True,
        )
        raise HTTPException(
            502,
            "No se pudo enviar el correo de acceso. Intenta nuevamente en unos minutos.",
        )


@app.on_event("startup")
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


@app.get("/health")
def health():
    return {"status": "ok", "service": "auth"}


@app.post("/auth/register", status_code=201)
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


@app.post("/auth/login")
def login(p: Login, request: Request, s: Session = Depends(db)):
    check_login_rate_limit(request)
    return issue(p.username, p.password, s)


@app.post("/auth/token")
def token(
    request: Request, p: OAuth2PasswordRequestForm = Depends(), s: Session = Depends(db)
):
    check_login_rate_limit(request)
    if not 1 <= len(p.username) <= 254 or not 1 <= len(p.password) <= 128:
        raise HTTPException(422, "Longitud de credenciales inválida")

    return issue(p.username, p.password, s)


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


@app.get("/auth/me")
def me(u: User = Depends(authenticated_allow_password_change)):
    return serialize(u)


@app.put("/auth/password")
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


@app.get("/auth/users")
def users(_: User = Depends(admin), s: Session = Depends(db)):
    return [
        serialize(u)
        for u in s.scalars(select(User).order_by(User.created_at.desc())).all()
    ]


@app.patch("/auth/users/{uid}")
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


@app.get("/auth/roles")
def roles(_: User = Depends(admin), s: Session = Depends(db)):
    return [
        {"id": r.id, "description": r.description}
        for r in s.scalars(select(Role)).all()
    ]


@app.get("/internal/users/{uid}")
def internal_user(
    uid: str, x_internal_key: str = Header(default=""), s: Session = Depends(db)
):
    if not x_internal_key or not secrets.compare_digest(
        x_internal_key, INTERNAL
    ):
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


# Las instalaciones existentes requieren una migración incremental del esquema.


class RoleInput(BaseModel):
    id: str = Field(pattern="^[A-Z_]{3,30}$")
    description: str = Field(min_length=2, max_length=100)


class RoleEdit(BaseModel):
    description: str = Field(min_length=2, max_length=100)


class AdminRegistration(Registration):
    role_id: str = "CLIENTE"


@app.post("/auth/users", status_code=201)
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


@app.delete("/auth/users/{uid}")
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


@app.post("/auth/roles", status_code=201)
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


@app.put("/auth/roles/{rid}")
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


@app.delete("/auth/roles/{rid}")
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
