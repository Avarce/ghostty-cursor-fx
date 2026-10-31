// Cursor FX for Ghostty (see `cursor-fx`): the Enter signal when you send a prompt in pi,
// and the "done" signal when pi has finished and won't continue on its own.
// Copy this file to ~/.pi/agent/extensions/cursor-fx.ts, and turn on "Show hardware cursor"
// in pi's settings: pi hides the terminal cursor by default, and the effects follow it.
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const BIN = join(homedir(), ".local/bin/cursor-fx");

// Fire and forget: never make pi wait. Not detached, so cursor-fx runs on pi's terminal.
function signal(...args: string[]): void {
  if (!process.env.GHOSTTY_RESOURCES_DIR) return;
  try {
    const child = spawn(BIN, ["signal", ...args], { stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch {}
}

export default function (pi: any) {
  // A prompt typed in the editor (not one sent by an extension or over RPC).
  pi.on("input", (event: any) => {
    if (event.source === "interactive") signal();
    return { action: "continue" };
  });
  // agent_end isn't final (retries, compaction, queued messages); agent_settled is.
  pi.on("agent_settled", (event: any) => {
    if (!event.aborted) signal("done");
  });
}
