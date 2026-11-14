#!/usr/bin/env bash
# Starts the game so phones on the same Wi-Fi can join.
# Needs Node.js (https://nodejs.org). Press Ctrl+C to stop the game.

cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1
PORT=8766
URL="http://localhost:$PORT/"

printf '\033]0;Every Kilogram - team game - Ctrl+C to stop\007'

if ! command -v node >/dev/null 2>&1; then
  echo
  echo " Playing on phones needs Node.js, which is not installed on this computer."
  echo " Get it free from https://nodejs.org and run this file again."
  echo
  echo " You can still play right now without it: run ./play.sh"
  echo " and choose \"One screen\" (everyone around this device) or \"Solo\"."
  echo
  read -r -p "Press Enter to close..." _
  exit 1
fi

echo
echo " EVERY KILOGRAM - team game"
echo " ------------------------------------------------------"
echo " Phones must be on the same Wi-Fi as this computer."
echo " The address to type on a phone is printed just below,"
echo " and the big screen shows a room code and a QR code."
echo " If your firewall asks, choose Allow."
echo " Press Ctrl+C to stop the game."
echo " ------------------------------------------------------"
echo

# Open the browser two seconds from now, once the server is listening.
(
  sleep 2
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1
  elif command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1
  elif command -v wslview >/dev/null 2>&1; then
    wslview "$URL" >/dev/null 2>&1
  else
    echo "Open this address in your browser: $URL"
  fi
) &

node tools/serve.mjs "$PORT" 0.0.0.0
status=$?

if [ "$status" -ne 0 ]; then
  echo
  echo "The game could not start on port $PORT."
  echo "Close other copies of the game and try again."
  read -r -p "Press Enter to close..." _
fi
exit "$status"
