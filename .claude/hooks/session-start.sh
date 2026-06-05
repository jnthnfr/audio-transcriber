#!/bin/bash
# SessionStart hook: ensures git commits made during this session are
# attributed to the repository owner rather than the harness's default
# identity, which resets between sessions.
set -euo pipefail

git config --global user.name "jnthnfr"
git config --global user.email "jonathanfreiku@gmail.com"
