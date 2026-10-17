@echo off
title Mytho_AI Pharmacy Chatbot
cd /d "%~dp0"

if not exist "venv\Scripts\python.exe" (
  echo Creating virtual environment...
  python -m venv venv
  if errorlevel 1 (
    echo Python not found. Install Python 3.11+ from https://www.python.org/downloads/
    pause
    exit /b 1
  )
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
)

if not exist "logs" mkdir logs

echo Installing/updating packages...
venv\Scripts\python.exe -m pip install --upgrade pip >nul
venv\Scripts\pip.exe install "flask==2.3.3" "flask-cors==4.0.0" "python-dotenv==1.0.0" "requests==2.31.0" "psycopg[binary]==3.2.9"
if errorlevel 1 (
  echo Package install failed.
  pause
  exit /b 1
)

echo.
echo Starting Mytho_AI on http://localhost:5001 ...
echo Keep this window OPEN while using Pharmacy chatbot.
echo Press Ctrl+C to stop.
echo.
venv\Scripts\python.exe server.py
pause
