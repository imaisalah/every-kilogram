@echo off
rem Starts a local web server for the game and opens it in your browser.
rem Nothing to install: uses Node.js if present, then Python, then the
rem PowerShell that comes with Windows. Close this window to stop the game.
cd /d "%~dp0"
set PORT=8765
title Every Kilogram - close this window to stop the game

rem Open the browser two seconds from now, once the server is listening.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:%PORT%/'"

where node >nul 2>nul && (node tools\serve.mjs %PORT% & goto :eof)

rem "where python" also finds the Microsoft Store shortcut, which is not Python,
rem so check that Python really runs before using it.
python -c "import http.server" >nul 2>nul && (python -m http.server %PORT% & goto :eof)

powershell -NoProfile -ExecutionPolicy Bypass -File "tools\serve.ps1" %PORT%
if errorlevel 1 (
  echo.
  echo The game could not start a local server on port %PORT%.
  echo Close other copies of the game and try again.
  pause
)
