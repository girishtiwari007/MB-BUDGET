@echo off
setlocal

cd /d "%~dp0"

echo.
echo MB-BUDGET Local Current-Year Data Sync
echo ----------------------------------------
echo This copies the six latest current-year files into data\source-files,
echo keeps the latest two backup copies, and refreshes local portal metadata.
echo.
echo Default source:
echo   C:\Users\HP\Downloads\PORTAL DATA
echo.

python scripts\local-sync-current-year.py

echo.
echo Done. Verify at http://127.0.0.1:8000/ and commit/push when ready.
pause >nul
