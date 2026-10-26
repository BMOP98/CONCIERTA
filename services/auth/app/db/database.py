"""CONCIERTA Auth: módulo separado sin cambiar las reglas originales."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import URL

engine = create_engine(URL, pool_pre_ping=True)
SessionLocal = sessionmaker(engine)


class Base(DeclarativeBase):
    pass


def db():
    with SessionLocal() as s:
        yield s
