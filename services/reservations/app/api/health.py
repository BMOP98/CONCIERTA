"""Reservation HTTP handlers; original request/response contracts preserved."""

import os, secrets, io, qrcode
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import Response
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from ..core.security import user, admin, internal
from ..core.config import INTERNAL
from ..db.database import db
from ..models.entities import Reservation, Ticket
from ..schemas.reservations import ReserveIn, ValidateIn
from ..services.helpers import utcnow, expire, asdict, catalog, event_info, write_audit
from ..services.notifications import email_confirmation_job
from ..documents import ticket_pdf, summary_pdf

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "service": "reservations"}
