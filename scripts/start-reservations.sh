#!/usr/bin/env bash
cd "$(dirname "$0")/../services/reservations" && .venv/bin/uvicorn app.main:app --reload --port 8003
