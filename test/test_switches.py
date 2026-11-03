#!/usr/bin/env python3
"""Which config the shader switches follow. Run: python3 test/test_switches.py"""
import importlib.machinery
import importlib.util
import os
import stat
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
TOOL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "bin", "cursor-fx")
SHOW_CONFIG = "theme = light:day,dark:night\nbackground-opacity = 0.85\n"


def load_tool(config):
    os.environ["CURSOR_FX_CONFIG"] = config
    loader = importlib.machinery.SourceFileLoader("cursor_fx", TOOL)
    spec = importlib.util.spec_from_loader("cursor_fx", loader)
    tool = importlib.util.module_from_spec(spec)
    loader.exec_module(tool)
    return tool


class Switches(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = os.path.realpath(tmp.name)
        self.saved = dict(os.environ)
        self.addCleanup(lambda: (os.environ.clear(), os.environ.update(self.saved)))
        os.environ.pop("HERDR_ENV", None)
        os.environ["HOME"] = os.path.join(self.root, "home")
        os.environ["XDG_CONFIG_HOME"] = os.path.join(self.root, "xdg")
        self.folder = os.path.join(self.root, "xdg", "ghostty")
        os.makedirs(self.folder)
        # A stand-in for `ghostty +show-config`: what the running Ghostty resolved.
        self.ghostty = os.path.join(self.root, "ghostty")
        with open(self.ghostty, "w", encoding="utf-8") as f:
            f.write("#!/bin/sh\ncat <<'CONF'\n" + SHOW_CONFIG + "CONF\n")
        os.chmod(self.ghostty, os.stat(self.ghostty).st_mode | stat.S_IXUSR)

    def wanted(self, config):
        with open(config, "w", encoding="utf-8") as f:
            f.write("# only the effect choice\n")
        tool = load_tool(config)
        tool.GHOSTTY = self.ghostty
        return tool.wanted_switches()

    def test_include_in_the_ghostty_folder_follows_what_ghostty_loads(self):
        want = self.wanted(os.path.join(self.folder, "cursor-fx.conf"))
        self.assertTrue(want["LIGHT_THEME"])
        self.assertTrue(want["SEE_THROUGH"])

    def test_sandbox_config_elsewhere_stays_isolated(self):
        want = self.wanted(os.path.join(self.root, "sandbox.conf"))
        self.assertFalse(want["LIGHT_THEME"])
        self.assertFalse(want["SEE_THROUGH"])


if __name__ == "__main__":
    unittest.main()
