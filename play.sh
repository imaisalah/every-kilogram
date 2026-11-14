#!/usr/bin/env bash
# Starts a local web server for the game and opens it in your browser.
# Nothing to install: uses Node.js if present, then Python, then PowerShell
# (pwsh) if you happen to have it. Press Ctrl+C to stop the game.

cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1
PORT=8765
URL="http://localhost:$PORT/"

# Set the terminal title (works in most terminals).
printf '\033]0;Every Kilogram - press Ctrl+C to stop the game\007'

# Open the browser two seconds from now, once the server is listening.
open_browser() {
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
}
open_browser &

if command -v node >/dev/null 2>&1; then
  node tools/serve.mjs "$PORT"
  status=$?
else
  # Check that Python really runs before using it (some systems ship stubs).
  py=""
  for candidate in python3 python; do
    if "$candidate" -c "import http.server" >/dev/null 2>&1; then
      py="$candidate"
      break
    fi
  done

  if [ -n "$py" ]; then
    "$py" -m http.server "$PORT"
    status=$?
  elif command -v pwsh >/dev/null 2>&1; then
    pwsh -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1 "$PORT"
    status=$?
  else
    echo
    echo "Could not find Node.js or Python on this computer."
    echo "Install one of them (https://nodejs.org or https://python.org) and run this again."
    status=1
  fi
fi

if [ "$status" -ne 0 ]; then
  echo
  echo "The game could not start a local server on port $PORT."
  echo "Close other copies of the game and try again."
  read -r -p "Press Enter to close..." _
fi
exit "$status"
