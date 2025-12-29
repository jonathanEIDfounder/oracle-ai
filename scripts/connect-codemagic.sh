#!/bin/bash
echo "═══════════════════════════════════════════════════════════"
echo "  Oracle AI - Codemagic Auto-Connect"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Opening Codemagic setup..."
echo ""
xdg-open "https://codemagic.io/app/add-application?repoUrl=https://github.com/jonathanEIDfounder/oracle-ai" 2>/dev/null || \
open "https://codemagic.io/app/add-application?repoUrl=https://github.com/jonathanEIDfounder/oracle-ai" 2>/dev/null || \
echo "https://codemagic.io/app/add-application?repoUrl=https://github.com/jonathanEIDfounder/oracle-ai"
echo ""
echo "After connecting, update CM_APP_ID secret with your app ID."
echo "Future builds will trigger automatically on git push."
