#!/bin/sh
# Points git at the tracked hooks in scripts/hooks/.
cd "$(git rev-parse --show-toplevel)" || exit 1
chmod +x scripts/hooks/pre-commit
git config core.hooksPath scripts/hooks
echo "git hooks installed (core.hooksPath=scripts/hooks)"
