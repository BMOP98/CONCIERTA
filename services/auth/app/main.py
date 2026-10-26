"""CONCIERTA - Microservicio de Autenticación."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import config as _config
from app.db.bootstrap import init
from app.api import auth, users, roles, internal


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicializar las tablas y configuraciones de autenticación.
    init()

    yield


app = FastAPI(
    title="Concierta · Autenticación",
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


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "auth",
    }


for router in (
    auth.router,
    users.router,
    roles.router,
    internal.router,
):
    app.include_router(router)
