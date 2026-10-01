#!/usr/bin/env bash
# One command: commit, deploy, and start the Documents/The Agency sync in the background (survives closing Terminal; restarts at login).
set -e
cd "$(dirname "$0")/.."
bash scripts/deploy.sh
NODE=$(command -v node)
PLIST="$HOME/Library/LaunchAgents/com.agency.contentsync.plist"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Documents/The Agency"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.agency.contentsync</string>
<key>ProgramArguments</key><array><string>$NODE</string><string>$PWD/scripts/sync-content.mjs</string><string>$HOME/Documents/The Agency</string><string>--watch</string></array>
<key>WorkingDirectory</key><string>$PWD</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>$HOME/Library/Logs/agency-sync.log</string>
<key>StandardErrorPath</key><string>$HOME/Library/Logs/agency-sync.log</string>
</dict></plist>
PL
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Sync running in background for: $HOME/Documents/The Agency"
