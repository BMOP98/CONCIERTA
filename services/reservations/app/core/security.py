"""JWT authentication and authorization, backed by live Auth user state."""

import os, secrets, httpx
from fastapi import Depends, Header, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from .config import SECRET, INTERNAL

oauth = OAuth2PasswordBearer(tokenUrl="/auth/token")


def user(token: str = Depends(oauth)):
    try:
        claims = jwt.decode(token, SECRET, algorithms=["HS256"])
        uid = claims["sub"]
    except (JWTError, KeyError):
        raise HTTPException(401, "Token inválido")

    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.get(
                os.getenv("AUTH_URL", "http://localhost:8001")
                + "/internal/users/"
                + uid,
                headers={"x-internal-key": INTERNAL},
            )
            response.raise_for_status()
            account = response.json()

    except (httpx.RequestError, httpx.HTTPStatusError, ValueError):
        raise HTTPException(503, "No se pudo verificar la cuenta con Autenticación")

    if not account.get("exists") or not account.get("active"):
        raise HTTPException(401, "Cuenta inexistente o desactivada")

    if account.get("must_change_password"):
        raise HTTPException(403, "Debes cambiar tu contraseña antes de continuar")

    # El rol válido es el actual en la base de datos,
    # no necesariamente el que figura en el JWT.
    if type(claims.get("token_version")) is not int or claims[
        "token_version"
    ] != account.get("token_version"):
        raise HTTPException(401, "Sesión invalidada. Inicia sesión nuevamente")
    claims["role"] = account["role"]

    return claims


def internal(x_internal_key: str = Header(default="")):
    if not secrets.compare_digest(x_internal_key, INTERNAL):
        raise HTTPException(403, "Acceso interno denegado")


def admin(u=Depends(user)):
    if u.get("role") != "ADMIN":
        raise HTTPException(403, "Se requiere ADMIN")
    return u
