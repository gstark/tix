import { loadConfig } from "../config.ts";
import { TixError } from "../errors.ts";
import { loadBoardWidth, saveBoardWidth } from "../tui/prefs.ts";
import { noPositionals, projectKey } from "./command.ts";
import type { Command } from "./command.ts";

export const tui: Command = {
  name: "tui",
  usage: "tui [--all-projects]",
  summary: "Open the live board in the terminal.",
  notes: [
    "",
    "  --all-projects    Show the tasks of all projects",
    "",
    "The board shows the current project. Outside a git repository it shows all projects.",
    "Changes from other machines and agents show at once. Press ? on the board to see the keys.",
    "Set TIX_MOTION=off to turn off the flip animation.",
    "Drag the line between the list and the ticket to resize them. tix saves the width.",
  ],
  options: { "all-projects": { type: "boolean" } },
  async run(ctx, input) {
    noPositionals(input);
    if (input.json) throw new TixError("USAGE", "tui has no --json output");
    if (!process.stdout.isTTY) throw new TixError("USAGE", "tui needs a terminal");
    const config = await loadConfig(ctx.env);
    const savedBoardWidth = await loadBoardWidth(ctx.env);
    const key =
      input.values["all-projects"] === true ? null : await projectKey(ctx, input).catch(() => null);
    // OpenTUI loads native code, so only `tix tui` loads it.
    const { runTui } = await import("../tui/run.tsx");
    await runTui({
      config,
      scope: key === null ? { kind: "all" } : { kind: "project", key },
      git: ctx.git,
      cwd: ctx.cwd,
      savedBoardWidth,
      onBoardWidth: (width) => saveBoardWidth(ctx.env, width),
    });
  },
};
