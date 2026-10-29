import { saveConfig } from "../config.ts";
import { noPositionals, print, requiredOption } from "./command.ts";
import type { Command } from "./command.ts";

export const login: Command = {
  name: "login",
  usage: "login --url <url> --token <token>",
  summary: "Write the local configuration.",
  notes: ["", "The file is ~/.config/tix/config.toml, or TIX_CONFIG. It has mode 0600."],
  options: { url: { type: "string" }, token: { type: "string" } },
  async run(ctx, input) {
    noPositionals(input);
    const path = await saveConfig(ctx.env, {
      convexUrl: requiredOption(input, "url"),
      token: requiredOption(input, "token"),
    });
    print(ctx, input, { path }, () => [`Saved the configuration to ${path}`]);
  },
};
