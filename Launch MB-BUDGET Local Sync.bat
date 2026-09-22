@echo off
setlocal
cd /d "%~dp0"
python scripts\local-sync-gui.py
if errorlevel 1 (
  echo.
  echo MB-BUDGET Local Data Sync failed to start.
  echo Make sure Python is installed and this file is inside the MB-BUDGET repo folder.
  pause
)
