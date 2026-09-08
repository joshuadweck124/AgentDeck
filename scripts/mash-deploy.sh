#!/usr/bin/env bash
# Build the MASH fork of the Stream Deck plugin and install it into the Stream Deck app.
#   scripts/mash-deploy.sh          fast path: copy the built bundle in place and restart the plugin
#   scripts/mash-deploy.sh --pack   full install through the Stream Deck app (needed when the bundled
#                                   profile changed; the app imports embedded profiles only on install;
#                                   the app shows an Install prompt that must be clicked)
set -euo pipefail
cd "$(dirname "$0")/.."
PLUG=bound.serendipity.agentdeck.sdPlugin
DEST="$HOME/Library/Application Support/com.elgato.StreamDeck/Plugins/$PLUG"
pnpm --filter @agentdeck/shared build >/dev/null
pnpm --filter @agentdeck/plugin build >/dev/null
pnpm generate-icons >/dev/null
pnpm generate-streamdeck-profiles >/dev/null
if [ "${1:-}" = "--pack" ]; then
  OUT=$(mktemp -d)
  node_modules/.bin/streamdeck pack "plugin/$PLUG" -o "$OUT" --force >/dev/null
  pkill -9 -f "Elgato Stream Deck.app/Contents/MacOS/Stream Deck" || true; sleep 2
  rm -rf "$DEST"
  open -a "Elgato Stream Deck"; sleep 8
  open -a "Elgato Stream Deck" "$OUT/bound.serendipity.agentdeck.streamDeckPlugin"
  echo "install started — click Install in the Stream Deck app if it asks"
  exit 0
fi
rm -rf "$DEST"
cp -R "plugin/$PLUG" "$DEST"
rm -rf "$DEST/logs"
node_modules/.bin/streamdeck restart bound.serendipity.agentdeck
echo "deployed $(python3 -c "import json;print(json.load(open('$DEST/manifest.json'))['Version'])") to Stream Deck"
