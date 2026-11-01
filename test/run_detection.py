#!/usr/bin/env python3
"""Run test/detection.js for every shader in headless Chrome and print a table.

    test/run_detection.py [--shaders DIR]   DIR defaults to shaders/, relative paths are fine

Exits 1 when a shader does not compile or a check fails.
"""
import argparse, functools, http.server, json, os, pathlib, re, shutil, socketserver, subprocess, sys, tempfile, threading, urllib.parse

CHROME = next((p for p in ("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                           shutil.which("google-chrome") or "", shutil.which("chromium") or "") if p and os.path.exists(p)), None)
LIT = 150  # changed pixels along the box lines that count as lit


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def run(url, profile):
    out = subprocess.run([CHROME, "--headless=new", "--use-angle=metal", "--enable-unsafe-swiftshader", f"--user-data-dir={profile}",
                          "--virtual-time-budget=120000", "--dump-dom", url], capture_output=True, text=True, timeout=300).stdout
    m = re.search(r"RESULT (\{.*?\})</div>", out.replace("&quot;", '"'))
    return json.loads(m.group(1)) if m else {"failed": "no result: " + out[-300:]}


def verdict(r):
    if "failed" in r:
        return [r["failed"][:200]]
    cases = {k: v for k, v in r.items() if k not in ("underline", "hash")}
    bad = [f"{k}: not found" for k, v in cases.items() if not v["found"]]
    bad += [f"{k}: Enter did not light the lines ({v['lit']}px)" for k, v in cases.items() if v["lit"] < LIT]
    bad += [f"{k}: spills out of the pane ({v['spill']}px)" for k, v in cases.items() if v["spill"] > 40]
    if r["underline"]["tinted"] > 40:
        bad.append(f"underline taken for a box line ({r['underline']['tinted']}px)")
    return bad


def main():
    a = argparse.ArgumentParser(description=__doc__)
    a.add_argument("--shaders", default=None)
    a.add_argument("--set", default="", help='settings to override, as JSON: {"LINE_TINT":"false"}')
    a.add_argument("--only", default="", help="only shaders whose name contains this")
    a.add_argument("--bg", default="2a2a2a", help="the theme's background, as hex")
    a.add_argument("--fg", default="c6bba3", help="the theme's foreground, as hex")
    a.add_argument("--opacity", default="1", help="background-opacity of the window")
    a.add_argument("--linear", default="1", help="0: an sRGB screen texture, as on macOS")
    a.add_argument("--hashes", action="store_true", help="also print a hash of each shader's frames")
    args = a.parse_args()
    if not CHROME:
        sys.exit("no Chrome found")
    repo = pathlib.Path(__file__).resolve().parent.parent
    shaders = pathlib.Path(args.shaders).resolve() if args.shaders else repo / "shaders"
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp) / "www"
        root.mkdir()
        (root / "repo").symlink_to(repo)
        (root / "shaders").symlink_to(shaders)
        handler = functools.partial(Quiet, directory=str(root))
        with socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler) as srv:
            threading.Thread(target=srv.serve_forever, daemon=True).start()
            port = srv.server_address[1]
            failed = 0
            for f in sorted(p for p in shaders.glob("*.glsl") if args.only in p.name):
                color = "9fd0fe"
                url = f"http://127.0.0.1:{port}/repo/test/cjk.html?shader=/shaders/{f.name}&color={color}&bg={args.bg}&fg={args.fg}&opacity={args.opacity}&linear={args.linear}&run=detection.js"
                # The cursor's own look is not under test, and its glow reaches the rows around it.
                # LINE_TINT shows a line was found without a signal; teleport ships with it off.
                settings = {"CURSOR_EFFECT": "false", "LINE_TINT": "true", **json.loads(args.set or "{}")}
                url += "&set=" + urllib.parse.quote(json.dumps(settings))
                r = run(url, pathlib.Path(tmp) / "profile")
                bad = verdict(r)
                failed += bool(bad)
                nums = " ".join(f"{k}:{v['lit']}/{v['spill']}" for k, v in r.items() if k not in ("underline", "hash")) if "failed" not in r else ""
                if args.hashes and "hash" in r:
                    nums = f"hash={r['hash']} dark={r['window']['darkShare']} {nums}"
                print(f"{'FAIL' if bad else 'ok  '} {f.stem:20} {nums}")
                for b in bad:
                    print(f"       {b}")
    print(f"{failed} shaders failed")
    sys.exit(1 if failed else 0)


main()
