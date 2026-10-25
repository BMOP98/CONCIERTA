#!/usr/bin/env bash
cd "$(dirname "$0")/../services/auth" && .venv/bin/uvicorn app.main:app --reload --port 8001
