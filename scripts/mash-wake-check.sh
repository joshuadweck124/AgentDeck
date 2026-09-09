#!/usr/bin/env bash
# MASH fork: run ~15s after a system wake (spawned by the daemon). If the Stream
# Deck is on USB but the Stream Deck app has not re-connected to it since the
# wake, restart the app so it re-opens the device. Logs to ~/.agentdeck/wake-check.log
LOG="$HOME/.agentdeck/wake-check.log"
WAKE_AT="${1:-$(date +%s)}"
sleep "${MASH_WAKE_DELAY:-15}"
now=$(date "+%Y-%m-%d %H:%M:%S")
if ! ioreg -p IOUSB -w0 2>/dev/null | grep -q "Stream Deck"; then
  echo "$now  deck ABSENT from USB after wake (hub/dock did not bring it back) — nothing software can do" >> "$LOG"
  exit 0
fi
SDLOG="$HOME/Library/Logs/ElgatoStreamDeck/StreamDeck.log"
# last "device status changed ... connected" line time (local) → epoch
last=$(grep "device status changed" "$SDLOG" 2>/dev/null | grep -i "connected" | tail -1 | cut -c1-19 | tr 'T' ' ')
last_epoch=0
[ -n "$last" ] && last_epoch=$(date -j -f "%Y-%m-%d %H:%M:%S" "$last" +%s 2>/dev/null || echo 0)
if [ "$last_epoch" -ge "$((WAKE_AT - 5))" ]; then
  echo "$now  deck present, app reconnected at $last — ok" >> "$LOG"
  exit 0
fi
echo "$now  deck present on USB but app has not reconnected since wake (last connect: ${last:-never}) — restarting Stream Deck app" >> "$LOG"
pkill -TERM -f "Elgato Stream Deck.app/Contents/MacOS/Stream Deck" 2>/dev/null; sleep 4
pkill -9 -f "Elgato Stream Deck.app/Contents/MacOS/Stream Deck" 2>/dev/null; sleep 1
open -a "Elgato Stream Deck"
