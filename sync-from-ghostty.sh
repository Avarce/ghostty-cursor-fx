#!/bin/bash
# Copy the live files (shaders, presets, cursor-fx) from your Ghostty setup back into this folder.
#
# Your own choices stay out of the repo: a setting whose installed value differs from the
# defaults recorded at install (cursor-effects/.installed-defaults.json) is yours, and the repo
# keeps the recorded default. To make the live values the new defaults (you changed a default
# on purpose), run it with --as-defaults: everything is copied as it is and recorded.
set -euo pipefail
here="$(cd -- "$(dirname -- "$0")" && pwd)"
config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/ghostty"
cp -p "$config_dir"/shaders/*-cursor.glsl "$here/shaders/"
cp -p "$config_dir"/cursor-effects/*.conf "$here/cursor-effects/"
cp -p "$HOME/.local/bin/cursor-fx" "$here/bin/cursor-fx"
if [ "${1:-}" = "--as-defaults" ]; then
  python3 - "$here" "$config_dir" <<'EOF'
import importlib.machinery, importlib.util, json, os, sys
here, config_dir = sys.argv[1], sys.argv[2]
loader = importlib.machinery.SourceFileLoader("cursor_fx", os.path.join(here, "bin", "cursor-fx"))
spec = importlib.util.spec_from_loader("cursor_fx", loader); fx = importlib.util.module_from_spec(spec); loader.exec_module(fx)
snap = fx.settings_snapshot(os.path.join(here, "shaders"), os.path.join(here, "cursor-effects"))
with open(os.path.join(config_dir, "cursor-effects", ".installed-defaults.json"), "w", encoding="utf-8") as f:
    json.dump(snap, f, indent=1)
print("Copied as they are and recorded as the defaults.")
EOF
  exit 0
fi
python3 - "$here" "$config_dir" <<'EOF'
import importlib.machinery, importlib.util, json, os, re, sys
here, config_dir = sys.argv[1], sys.argv[2]
record = os.path.join(config_dir, "cursor-effects", ".installed-defaults.json")
if not os.path.isfile(record):
    sys.exit(0)  # no record: only the fixed resets below
loader = importlib.machinery.SourceFileLoader("cursor_fx", os.path.join(here, "bin", "cursor-fx"))
spec = importlib.util.spec_from_loader("cursor_fx", loader); fx = importlib.util.module_from_spec(spec); loader.exec_module(fx)
with open(record, encoding="utf-8") as f:
    base = json.load(f)
mine = fx.settings_snapshot(os.path.join(here, "shaders"), os.path.join(here, "cursor-effects"))
kept = []
for entry, values in mine["shaders"].items():
    was = base.get("shaders", {}).get(entry, {})
    for name, (kind, value) in values.items():
        if name in was and was[name][0] == kind and fx.setting_key(kind, value) != fx.setting_key(kind, was[name][1]):
            fx.set_shader_value(os.path.join(here, "shaders", entry), name, was[name][1])
            kept.append(f"{entry[:-12]} {name} = {value}")
for entry, values in mine["presets"].items():
    was = base.get("presets", {}).get(entry)
    if was is None:
        continue
    path = os.path.join(here, "cursor-effects", entry)
    with open(path, encoding="utf-8") as f:
        lines = f.readlines()
    for key in ("cursor-color", "cursor-style-blink"):
        if (values.get(key) or "").strip().lower() == (was.get(key) or "").strip().lower():
            continue
        pattern = re.compile(r"^\s*" + key + r"\s*=")
        lines = [l for l in lines if not pattern.match(l)]
        if was.get(key) is not None:
            if key == "cursor-color":  # after the "# Name: description" line
                at = 1 if lines and lines[0].startswith("#") else 0
            else:                      # after the cursor color
                at = next((i + 1 for i, l in enumerate(lines) if l.startswith("cursor-color")), len(lines))
            lines.insert(at, f"{key} = {was[key]}\n")
        kept.append(f"{entry[:-5]} {key} = {values.get(key)}")
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(lines)
if kept:
    print("Kept out of the repo (your own settings): " + ", ".join(kept))
EOF
# Without a record: what a new user gets anyway (every effect's Enter, done and delete-all
# on, the full version, cyber typing with burn-in).
perl -pi -e 's/^(const bool\s+(?:ENTER_EFFECT|DONE_EFFECT|JUMP_EFFECTS)\s*=\s*)false;/${1}true;/' "$here"/shaders/*-cursor.glsl
perl -pi -e 's/^(const bool\s+SUBTLE\s*=\s*)true;/${1}false;/' "$here"/shaders/*-cursor.glsl
perl -pi -e 's/^(const int\s+DECODE_STYLE\s*=\s*)\d+;/${1}4;/' "$here"/shaders/cyber-cursor.glsl
# The see-through switch follows each user's Ghostty config (cursor-fx sets it); the repo ships it off.
perl -pi -e 's/^(#define\s+SEE_THROUGH\s+)true\b/${1}false/' "$here"/shaders/*-cursor.glsl
echo "Synced from $config_dir and ~/.local/bin."
