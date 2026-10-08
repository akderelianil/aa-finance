#!/usr/bin/env bash
# Run inside Ubuntu (WSL). Installs the toolchain and moves the repo to the Linux filesystem.
set -euo pipefail

WIN_REPO="${WIN_REPO:-/mnt/c/Users/anil-akdereli/aa-finance}"
DEST="$HOME/aa-finance"

sudo apt-get update
sudo apt-get install -y git curl ca-certificates build-essential python3 python3-venv pipx jq unzip

# Node LTS via nvm
if [ ! -d "$HOME/.nvm" ]; then
  curl -fsSo- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm install --lts

# Claude Code, graphify
npm install -g @anthropic-ai/claude-code
pipx ensurepath
pipx install "graphifyy[sql]" || pipx upgrade graphifyy

# Git identity from the Windows side
git config --global user.name "$(git -C "$WIN_REPO" config user.name)"
git config --global user.email "$(git -C "$WIN_REPO" config user.email)"
git config --global core.autocrlf input

# Repo: clone from the Windows copy (no remote exists), keep it off /mnt/c for speed
if [ ! -d "$DEST/.git" ]; then git clone "$WIN_REPO" "$DEST"; fi
cd "$DEST"

# Untracked secrets: copy only if missing, never print
[ -f .env ] || { [ -f "$WIN_REPO/.env" ] && cp "$WIN_REPO/.env" .env && chmod 600 .env; }

# Linux has a working graphify binary: drop the Windows .cmd wrapper from hooks and docs
sed -i 's#scripts/graphify\.cmd#graphify#g' .claude/settings.json CLAUDE.md docs/DEVELOPMENT.md
git rm -q --cached scripts/graphify.cmd 2>/dev/null && rm -f scripts/graphify.cmd || true

(cd web && npm install)
graphify update . && graphify hook install

echo "Done. Review 'git status' in $DEST, then: cd $DEST && claude"
