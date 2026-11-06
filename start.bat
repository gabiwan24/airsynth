@echo off
setlocal
cd /d "%~dp0"

REM ==== CONFIG (per project) ====
set "BASE_PORT=8100"

REM ==== find free port ====
set "PORT="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\find-port.ps1" %BASE_PORT%`) do set "PORT=%%P"
if not defined PORT (
  echo [start.bat] No free port found from %BASE_PORT% upwards.
  pause
  exit /b 1
)

echo [start.bat] http://localhost:%PORT%
REM open browser after a short delay (delete this line if not wanted)
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:%PORT%"

REM ==== START COMMAND (per project) ====
REM camera access needs a secure context: http://localhost counts as secure
python scripts\serve.py %PORT%

endlocal
