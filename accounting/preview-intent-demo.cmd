@echo off
cd /d "%~dp0"
python -B tools\preview_intent_demo.py
if errorlevel 1 pause
