@echo off
title Mytho_AI Watchdog
echo Starting Mytho_AI Watchdog...
echo Server will auto-restart if it crashes.
echo Press Ctrl+C to stop.
echo.
cd /d C:\MQE\Pharmacy-AI\Pharmacy-AI\Mytho_AI
venv\Scripts\python watchdog.py
pause
