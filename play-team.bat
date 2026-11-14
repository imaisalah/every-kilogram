@echo off
rem Starts the game so phones on the same Wi-Fi can join.
rem Needs Node.js (https://nodejs.org). Close this window to stop the game.
cd /d "%~dp0"
set PORT=8766
title Every Kilogram - team game - close this window to stop

where node >nul 2>nul
if errorlevel 1 goto :nonode

echo.
echo  EVERY KILOGRAM - team game
echo  ------------------------------------------------------
echo  Phones must be on the same Wi-Fi as this computer.
echo  The address to type on a phone is printed just below,
echo  and the big screen shows a room code and a QR code.
echo  If Windows asks about the firewall, choose Allow.
echo  Close this window to stop the game.
echo  ------------------------------------------------------
echo.

rem Open the browser two seconds from now, once the server is listening.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:%PORT%/'"

node tools\serve.mjs %PORT% 0.0.0.0
if errorlevel 1 (
  echo.
  echo The game could not start on port %PORT%.
  echo Close other copies of the game and try again.
  pause
)
goto :eof

:nonode
echo.
echo  Playing on phones needs Node.js, which is not installed on this computer.
echo  Get it free from https://nodejs.org and run this file again.
echo.
echo  You can still play right now without it: double-click play.bat
echo  and choose "One screen" (everyone around this device) or "Solo".
echo.
pause
