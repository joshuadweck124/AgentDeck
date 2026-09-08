#!/usr/bin/env bash
# Build the MASH fork of the Stream Deck plugin and install it into the Stream Deck app.
# Usage: scripts/mash-deploy.sh   (run from the AgentDeck repo root on Josh's Mac)
set -euo pipefail
cd "$(dirname "$0")/.."
PLUG=bound.serendipity.agentdeck.sdPlugin
DEST="$HOME/Library/Application Support/com.elgato.StreamDeck/Plugins/$PLUG"
pnpm --filter @agentdeck/shared build >/dev/null
pnpm --filter @agentdeck/plugin build >/dev/null
pnpm generate-icons >/dev/null
rm -rf "$DEST"
cp -R "plugin/$PLUG" "$DEST"
rm -rf "$DEST/logs"
node_modules/.bin/streamdeck restart bound.serendipity.agentdeck
echo "deployed $(python3 -c "import json;print(json.load(open('$DEST/manifest.json'))['Version'])") to Stream Deck"
