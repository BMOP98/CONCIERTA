"""CONCIERTA - Microservicio de Reservas."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core import config as _config
from .api import (
    health,
    availability,
    reservations,
    documents,
    tickets,
    reports,
)
from .services.expiration import (
    initialize,
    start_expiration_worker,
    stop_expiration_worker,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicialización de las tablas y migraciones.
    initialize()

    # Iniciar el proceso de expiración automática.
    start_expiration_worker()

    try:
        yield
    finally:
        # Detener el proceso cuando se cierra el servicio.
        stop_expiration_worker()


app = FastAPI(
    title="Concierta · Reservas",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("CORS_ORIGIN", "http://localhost:5173"),
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (
    health,
    availability,
    reservations,
    documents,
    tickets,
    reports,
):
    app.include_router(module.router)
