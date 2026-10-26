"""Validated service configuration; load project-level .env before DB imports."""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[4] / ".env")
SECRET = os.getenv("JWT_SECRET", "").strip()
INTERNAL = os.getenv("INTERNAL_SECRET", "").strip()
if len(SECRET) < 32:
    raise RuntimeError("JWT_SECRET no configurado correctamente")
if len(INTERNAL) < 32:
    raise RuntimeError("INTERNAL_SECRET no configurado correctamente")
DATABASE_NAME = os.getenv("DATABASE_NAME", "concierta_reservations")
