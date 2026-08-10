@echo off
setlocal

cd /d "%~dp0"

echo.
echo MB-BUDGET Local Upload Portal
echo ----------------------------------------
echo This starts the local upload server needed for Upload Data,
echo FR Upload, repository sync, backup copies, and generated payload refresh.
echo.
echo Open this URL after the server starts:
echo   http://127.0.0.1:8000/
echo.
echo Note: GitHub Pages is static/read-only for repository files.
echo For permanent monthly updates, upload locally here, verify, then commit/push.
echo.

python scripts\local-upload-server.py 8000

echo.
echo Server stopped. Press any key to close.
pause >nul
