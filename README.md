# tix

`tix` tracks private code tasks for agent coding. It stores the tasks in Convex, so all repositories and machines use the same data.

`tix` has:

- A CLI. Run `tix help` to see the commands.
- An MCP server. Run `tix mcp` to start it on stdio.
- A Claude Code plugin with the `tix` and `tix-plan` skills.

## Install

The install needs git, Node 24 or later, and pnpm.

1. Run the install script:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/gstark/tix/main/install.sh | bash
   ```

   The script does these steps:
   - It clones the repository into `~/.local/share/tix`.
   - It links `tix` into `~/.local/bin`.
   - If Claude Code is installed, it installs the tix plugin with the skills and the MCP server.
2. In a checkout with Convex access, run `just token <machine>`. Convex shows the token once.
3. Run `tix login --url <production URL> --token <token>`.

Run the install script again to update tix. You can set these variables:
- `TIX_DIR`: the checkout directory.
- `TIX_REPO`: the repository to clone.

## Backend Setup

Do this once:

1. Clone the repository.
2. Run `pnpm install`.
3. Log in to Convex: `pnpm exec convex login`.
4. Run `just setup`. It prints the production URL.

Run `just` to list the recipes.

## Development

- `pnpm test` runs the tests.
- `pnpm typecheck` runs the typecheck.
- Node runs the TypeScript source directly. There is no build.

The design is in `docs/specs/2026-10-29-tix-design.md`.

## Credits

`tix` is inspired by the implementation of [dex](https://github.com/dcramer/dex) by David Cramer.
