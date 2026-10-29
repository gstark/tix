#!/usr/bin/env node
import { main } from "./cli/main.ts";
import { convexClient } from "./client.ts";
import { loadConfig } from "./config.ts";
import { systemGit } from "./git.ts";

const env = process.env;
process.exitCode = await main(process.argv.slice(2), {
  cwd: process.cwd(),
  env,
  git: systemGit,
  client: async () => {
    const config = await loadConfig(env);
    return convexClient(config.convexUrl, config.token);
  },
  out: (text) => console.log(text),
  err: (text) => console.error(text),
});
