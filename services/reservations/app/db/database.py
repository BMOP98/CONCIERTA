"""PostgreSQL session factory and FastAPI dependency."""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from ..core.config import DATABASE_NAME

URL = (
    f"postgresql+psycopg://"
    f"{os.getenv('DATABASE_USER', 'concierta')}:"
    f"{os.getenv('DATABASE_PASSWORD')}@"
    f"{os.getenv('DATABASE_HOST', 'localhost')}:"
    f"{os.getenv('DATABASE_PORT', '5434')}/"
    f"{DATABASE_NAME}"
)
engine = create_engine(URL, pool_pre_ping=True)
SessionLocal = sessionmaker(engine)


class Base(DeclarativeBase):
    pass


def db():
    with SessionLocal() as s:
        yield s
