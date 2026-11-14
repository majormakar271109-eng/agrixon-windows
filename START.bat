@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not defined PORT set "PORT=3000"

set "NODE=%~dp0runtime\node.exe"
if not exist "%NODE%" set "NODE=node"

if /I "%NODE%"=="node" (
  where node >nul 2>&1
  if errorlevel 1 (
    echo.
    echo Node.js 20 or newer was not found.
    echo Install Node.js from https://nodejs.org/ and run START.bat again.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo  AGRIXON - local workspace
echo  Workspace: http://127.0.0.1:%PORT%
echo  Field tools: http://127.0.0.1:%PORT%/tools
echo  Close this window or press Ctrl+C to stop the server.
echo.

powershell -NoProfile -Command "if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) { if (Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue) { exit 1 } }" >nul 2>&1
if errorlevel 1 (
  echo Port %PORT% is already in use.
  echo Stop the previous AGRIXON server, or start on another port:
  echo    set PORT=3001
  echo    START.bat
  echo.
  pause
  exit /b 1
)

start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 40;$i++){try{Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:%PORT%/' -TimeoutSec 1 | Out-Null; break}catch{Start-Sleep -Milliseconds 250}}; Start-Process 'http://127.0.0.1:%PORT%/'"
"%NODE%" server-tools.mjs

echo.
echo Server stopped.
pause
