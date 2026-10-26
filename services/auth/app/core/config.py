"""CONCIERTA Auth: módulo separado sin cambiar las reglas originales."""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[4] / ".env")

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
