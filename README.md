# tix

`tix` tracks private code tasks for agent coding. It stores the tasks in Convex, so all repositories and machines use the same data.

`tix` has:

- A CLI. Run `tix help` to see the commands.
- An MCP server. Run `tix mcp` to start it on stdio.
- A Claude Code plugin with the `tix` and `tix-plan` skills.

## Setup

Run `just` to list the recipes.

Backend, once:

1. Log in to Convex: `pnpm exec convex login`.
2. Run `just setup`. It prints the production URL.

Each machine:

1. Clone the repository.
2. Run `just install`.
3. On a machine with Convex access, run `just token <machine>`.
4. Run `tix login --url <production URL> --token <token>`.
5. Run `just agent`.

## Development

- `pnpm test` runs the tests.
- `pnpm typecheck` runs the typecheck.
- Node runs the TypeScript source directly. There is no build.

The design is in `docs/specs/2026-10-29-tix-design.md`.

## Credits

`tix` is inspired by the implementation of [dex](https://github.com/dcramer/dex) by David Cramer.
