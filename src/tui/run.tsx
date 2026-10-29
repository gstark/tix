import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import type { Config } from "../config.ts";
import type { Git } from "../git.ts";
import type { Scope } from "./App.tsx";
import { App } from "./App.tsx";
import { Live } from "./live.ts";
import { color } from "./theme.ts";

/** Opens the board on the alternate screen and returns when the user quits. */
export async function runTui(options: { config: Config; scope: Scope; git: Git; cwd: string }): Promise<void> {
  const live = new Live(options.config);
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useMouse: true,
    targetFps: 60,
    backgroundColor: color.platform,
  });
  await new Promise<void>((resolve) => {
    createRoot(renderer).render(
      <App live={live} scope={options.scope} git={options.git} cwd={options.cwd} onQuit={resolve} />,
    );
  });
  renderer.destroy();
  await renderer.closed;
  await live.close();
}
