"""CONCIERTA Auth: módulo separado sin cambiar las reglas originales."""

from typing import Optional
from pydantic import BaseModel, EmailStr, Field


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


class RoleInput(BaseModel):
    id: str = Field(pattern="^[A-Z_]{3,30}$")
    description: str = Field(min_length=2, max_length=100)


class RoleEdit(BaseModel):
    description: str = Field(min_length=2, max_length=100)


class AdminRegistration(Registration):
    role_id: str = "CLIENTE"
