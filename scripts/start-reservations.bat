@echo off
cd /d "%~dp0..\services\reservations"
call .venv\Scripts\activate.bat
uvicorn app.main:app --reload --port 8003
