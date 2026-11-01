#!/usr/bin/env python3
"""Where `cursor-fx signal` goes: test/test_signal.py"""
import importlib.machinery, importlib.util, os, pathlib, subprocess, tempfile, types, unittest
from unittest import mock

path = pathlib.Path(__file__).resolve().parent.parent / "bin" / "cursor-fx"
loader = importlib.machinery.SourceFileLoader("cursor_fx", str(path))
spec = importlib.util.spec_from_loader("cursor_fx", loader)
fx = importlib.util.module_from_spec(spec)
loader.exec_module(fx)

PS = "ttys000  herdr\n??       /opt/homebrew/bin/herdr\nttys035  claude\nttys007  /opt/homebrew/bin/herdr\n"


def ps(*a, **k):
    return types.SimpleNamespace(stdout=PS)


class OuterTtys(unittest.TestCase):
    def test_outside_herdr_nothing(self):
        with mock.patch.dict(os.environ, clear=True):
            self.assertEqual(fx.outer_ttys(), [])

    def test_in_herdr_the_clients_with_a_terminal(self):
        with mock.patch.dict(os.environ, {"HERDR_ENV": "1"}), mock.patch.object(subprocess, "run", ps):
            self.assertEqual(fx.outer_ttys(), ["/dev/ttys000", "/dev/ttys007"])


class Targets(unittest.TestCase):
    def targets(self, env, outer):
        with tempfile.TemporaryDirectory() as t:
            conf = pathlib.Path(t, "config")
            conf.write_text("config-file = cursor-effects/neon.conf\n")
            with mock.patch.object(fx, "CONFIG", str(conf)), mock.patch.object(fx, "preset_color", lambda n: "#ff5ed2"), \
                    mock.patch.object(fx, "outer_ttys", lambda: outer), mock.patch.object(fx, "send_signal") as send:
                fx.signal_enter(["cursor-fx", "signal", "--tty", "/dev/pane"])
                return [c.args[0] for c in send.call_args_list]

    def test_plain_terminal_uses_its_own(self):
        self.assertEqual(self.targets({}, []), ["/dev/pane"])

    def test_herdr_goes_past_the_pane(self):
        self.assertEqual(self.targets({}, ["/dev/ttys000"]), ["/dev/ttys000"])


unittest.main()
