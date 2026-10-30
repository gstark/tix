# tix

`tix` tracks private code tasks for agent coding. It stores the tasks in Convex, so all repositories and machines use the same data.

`tix` has:

- A CLI. Run `tix help` to see the commands.
- A live board in the terminal. Run `tix tui` to open it.
- An MCP server. Run `tix mcp` to start it on stdio.
- A Claude Code plugin with the `tix` and `tix-plan` skills.

## Board

`tix tui` shows the tasks of the current project. Outside a git repository, or with `--all-projects`, it shows all projects. Convex sends each change at once, so you see the work of agents while they do it. When a status changes, its cell flips like a departures board.

The left pane shows the task tree. The right pane shows the selected task, with the description and the result in Markdown. You can click rows, filters, links, and buttons, and scroll with the mouse wheel. Drag the line between the panes to resize them. tix saves the list width in `ui.toml`, next to the config file.

| Keys | Action |
| --- | --- |
| `j` `k` `g` `G` | Select a task |
| `h` `l` `enter` | Close or open a subtree |
| `tab` | Move between the board and the ticket |
| `1` `2` `3` `4` | Show open, ready, all, or closed tasks |
| `/` | Find tasks by name or ID |
| `p` | Choose the project |
| `s` `d` `o` | Start, close, or reopen the task |
| `n` `a` | Create a task or a subtask |
| `e` `E` | Edit the task, or edit the description in `$EDITOR` |
| `b` `u` | Add or remove a blocker |
| `x` | Delete the task |
| `y` | Copy the short ID |
| `?` | Show all keys |
| `q` | Quit |

Set `TIX_MOTION=off` to turn off the flip animation.

## Install

The install needs git and [Bun](https://bun.com) 1.4 or later. Run `bun upgrade` to update Bun.

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
2. Run `bun install`.
3. Put your Convex team slug in `.env`: `TIX_TEAM=<team slug>`. Git ignores this file.
4. Log in to Convex: `bunx convex login`.
5. Run `just setup`. It prints the production URL.

Run `just` to list the recipes.

## Development

- `bun run test` runs the tests.
- `bun run typecheck` runs the typecheck.
- Bun runs the TypeScript source directly. There is no build.

The design is in `docs/specs/2026-10-29-tix-design.md`.

## Credits

`tix` is inspired by [dex](https://github.com/dcramer/dex), the task tracker for agents by [David Cramer](https://github.com/dcramer). dex showed the model that tix keeps:
- Tasks are tickets, with a name, a description, and a result.
- Agents use a CLI, an [MCP](https://modelcontextprotocol.io) server, and skills.
- Plans become trees of tasks.

`tix` moves the storage to [Convex](https://www.convex.dev), so all machines share the same tasks. Thank you, David.

## License

MIT. See [LICENSE](LICENSE).
