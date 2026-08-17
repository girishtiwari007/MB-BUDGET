@echo off
setlocal

cd /d "%~dp0"

echo.
echo MB-BUDGET Local FR Data Sync
echo ----------------------------------------
echo This updates data\fr\FR_Budget_Status.xlsx,
echo regenerates the FR Budget Status portal page,
echo and keeps the latest two FR backup copies.
echo.

python scripts\sync-fr-data.py "C:\Users\HP\Downloads\PORTAL DATA\FR 17.08.2026.xlsx"

echo.
echo Done. Verify at http://127.0.0.1:8000/pages/fr.html
pause >nul
