#!/bin/bash
# Install the cursor effects into Ghostty's config directory and `cursor-fx` into ~/.local/bin.
# Anything replaced is first copied to ~/ghostty-savepoints/<time>-before-install/.
set -euo pipefail

here="$(cd -- "$(dirname -- "$0")" && pwd)"
bin_dir="$HOME/.local/bin"
backup="$HOME/ghostty-savepoints/$(date +%Y%m%d-%H%M%S)-before-install"

command -v python3 >/dev/null || { echo "python3 is needed for cursor-fx."; exit 1; }
config_file="$(python3 "$here/bin/cursor-fx" config-path)"
[ -f "$config_file" ] || { echo "No Ghostty config at $config_file. Start Ghostty once, then run this again."; exit 1; }
config_dir="$(dirname "$config_file")"

# Ghostty hands shaders y-down pixels on macOS (Metal), y-up on Linux (OpenGL).
y_down=false; [ "$(uname -s)" = Darwin ] && y_down=true
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

mkdir -p "$config_dir/shaders" "$config_dir/cursor-effects" "$bin_dir"
# Upgrading: what you changed (in the panel, with cursor-fx, or by hand) goes back into the new version.
python3 "$here/bin/cursor-fx" _keep-save "$here" "$tmp/yours.json"
for f in "$here"/shaders/*.glsl "$here"/cursor-effects/*.conf; do
  sub="$(basename "$(dirname "$f")")"
  target="$config_dir/$sub/$(basename "$f")"
  if [ "$sub" = shaders ]; then
    sed "s/^#define Y_DOWN .*/#define Y_DOWN $y_down/" "$f" > "$tmp/$(basename "$f")"
    f="$tmp/$(basename "$f")"
  fi
  if [ -f "$target" ] && ! cmp -s "$f" "$target"; then
    mkdir -p "$backup/$sub" && cp -p "$target" "$backup/$sub/"
  fi
  cp -p "$f" "$target"
done
if [ -f "$bin_dir/cursor-fx" ] && ! cmp -s "$here/bin/cursor-fx" "$bin_dir/cursor-fx"; then
  mkdir -p "$backup" && cp -p "$bin_dir/cursor-fx" "$backup/cursor-fx"
fi
cp -p "$here/bin/cursor-fx" "$bin_dir/cursor-fx"
chmod +x "$bin_dir/cursor-fx"
python3 "$bin_dir/cursor-fx" _keep-apply "$tmp/yours.json" "$here"

echo "Installed cursor-fx $(python3 "$bin_dir/cursor-fx" --version | cut -d' ' -f2) into $config_dir (shaders/, cursor-effects/) and $bin_dir/cursor-fx."
[ -d "$backup" ] && echo "Replaced files were saved in $backup"
case ":$PATH:" in *":$bin_dir:"*) ;; *) echo "Note: $bin_dir is not on your PATH." ;; esac
cat <<EOF

Next:
  cursor-fx lightning        pick an effect (Ghostty reloads)
  cursor-fx edit             tune it in your browser
  hooks/claude-code-hook.json, hooks/pi-extension.ts and hooks/zsh-hook.zsh
                             the Enter and done signals (see README)
EOF
