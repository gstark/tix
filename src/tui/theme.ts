import { RGBA, SyntaxStyle } from "@opentui/core";
import type { CliRenderer } from "@opentui/core";
import type { Status } from "./board.ts";

/** The departures-board palette. */
export const color = {
  /** The background: blue slate, like the board at night. */
  platform: "#232B3E",
  /** The selected row, the flap cells, and dialogs. */
  rail: "#313B56",
  /** Hairlines between the panes. */
  rule: "#3E4966",
  chalk: "#E6E9F0",
  soot: "#8A93A8",
  /** The split-flap yellow: started tasks, the cursor, and the flip. */
  flap: "#FFC94D",
  /** Blocked tasks and errors. */
  signal: "#FF7A85",
  /** Closed tasks. */
  clear: "#7BD4A8",
} as const;

export const statusColor: Record<Status, string> = {
  open: color.chalk,
  doing: color.flap,
  wait: color.signal,
  done: color.clear,
};

/** The Markdown and code styles. Make one for each renderer. */
export function markdownStyle(renderer: CliRenderer): SyntaxStyle {
  const hex = RGBA.fromHex;
  return SyntaxStyle.fromStyles(
    {
      default: { fg: hex(color.chalk) },
      "markup.heading": { fg: hex(color.flap), bold: true },
      "markup.strong": { fg: hex(color.chalk), bold: true },
      "markup.italic": { fg: hex(color.chalk), italic: true },
      "markup.strikethrough": { fg: hex(color.soot), dim: true },
      "markup.quote": { fg: hex(color.soot), italic: true },
      "markup.list": { fg: hex(color.flap) },
      "markup.raw": { fg: hex(color.clear) },
      "markup.link": { fg: hex(color.flap), underline: true },
      "markup.link.label": { fg: hex(color.flap), underline: true },
      "markup.link.url": { fg: hex(color.soot) },
      conceal: { fg: hex(color.rule) },
      keyword: { fg: hex(color.signal) },
      string: { fg: hex(color.clear) },
      number: { fg: hex(color.flap) },
      comment: { fg: hex(color.soot), italic: true },
      function: { fg: hex(color.chalk), bold: true },
      type: { fg: hex(color.flap) },
      punctuation: { fg: hex(color.soot) },
    },
    renderer.nativeScene,
  );
}
