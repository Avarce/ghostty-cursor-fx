#!/bin/bash
# Copy the live, tuned files (shaders, presets, cursor-fx) from your Ghostty setup back into this folder.
set -euo pipefail
here="$(cd -- "$(dirname -- "$0")" && pwd)"
config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/ghostty"
cp -p "$config_dir"/shaders/*-cursor.glsl "$here/shaders/"
cp -p "$config_dir"/cursor-effects/*.conf "$here/cursor-effects/"
cp -p "$HOME/.local/bin/cursor-fx" "$here/bin/cursor-fx"
# What a new user gets: every effect's Enter, done and delete-all parts on, whatever you
# switched off for yourself (your installed files keep your choice).
perl -pi -e 's/^(const bool\s+(?:ENTER_EFFECT|DONE_EFFECT|JUMP_EFFECTS)\s*=\s*)false;/${1}true;/' "$here"/shaders/*-cursor.glsl
echo "Synced from $config_dir and ~/.local/bin (Enter, done and delete-all switched on in the repo copy)."
