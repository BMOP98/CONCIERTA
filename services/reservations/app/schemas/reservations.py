"""Request validation schemas unchanged from original."""

from pydantic import BaseModel, Field


class Item(BaseModel):
    section_id: int = Field(gt=0)
    seat_id: int | None = None
    quantity: int = Field(default=1, ge=1, le=6)


class ReserveIn(BaseModel):
    event_id: str
    items: list[Item] = Field(min_length=1, max_length=6)


class ValidateIn(BaseModel):
    qr_secret: str
