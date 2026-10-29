---
name: tix
description: Track code tasks with the tix CLI. Use to break down complex work, track implementation items, or keep context across sessions and machines.
---

# Track Code Tasks with tix

`tix` stores private code tasks in Convex. Every machine sees the same tasks. `tix` finds the project from the `origin` remote of the current directory.

## Tasks Are Tickets

A task has three text fields:

- **Name**: a one-line summary, like an issue title.
- **Description**: what to do, why, the approach, and how to verify it, like an issue body.
- **Result**: what you did, your decisions, and the verification evidence, like a pull request description.

Another agent must understand the what, why, and how from the task alone.

Do not put tix IDs in commits, pull requests, or documents. The IDs mean nothing outside tix. Describe the work instead.

## When to Use tix

Use tix when:

- You break complex work into subtasks.
- The work continues in another session or on another machine.
- You must keep context for a handoff.
- You must record decisions.

Do not use tix when:

- The work is one small action.
- The work fits in this session and has no follow-up.

The built-in task tools of your agent last for one session only. Use them for steps inside this session. Use tix for work that must persist.

## Commands

```bash
tix                                  # Open tasks of this project, as a tree
tix list --ready                     # Open tasks that no open task blocks
tix list --closed                    # Closed tasks
tix list --all-projects              # Tasks of all projects
tix show <id>                        # All fields, subtasks, and blockers
tix create "<name>" -d "<description>" [-p <priority>] [--parent <id>]
tix edit <id> [--name <n>] [-d <desc>] [-p <prio>] [--parent <id> | --no-parent]
tix start <id>                       # Record the start time
tix done <id> -r "<result>" [--commit <ref>]
tix reopen <id>
tix delete <id>                      # Also deletes all subtasks
tix block <id> --by <blocker-id>
tix unblock <id> --by <blocker-id>
tix projects                         # Projects with open task counts
tix help <command>
```

Every command accepts `--json` and `--project <key>`. Use `--project` when the current directory has no git remote.

Priority is a number from 0 to 100. A lower number is more important. The default is 1.

## Before You Start a Task

Read the full context:

```bash
tix show <id>              # The task
tix show <parent-id>       # The parent, if the task has one
tix show <blocker-id>      # What a closed blocker did
```

Make sure that you can answer these questions:

- **What** must you do?
- **Why** is it necessary?
- **How** must you do it?
- **When** is it done?

If an answer is not clear, read the parent and the blockers. If it is still not clear, suggest plan mode before you start.

Then run `tix start <id>`.

## Hierarchies

A tree has 3 levels at most: epic, task, and subtask.

- A small change in 1 or 2 files: one task.
- A feature with 3 to 7 steps: a task with subtasks.
- A large initiative with 5 or more tasks: an epic with tasks.

Give each parent 3 to 7 children. Each task must fit in one focused session.

```bash
tix create "Add token verification" --parent <id> -d "..."
```

A task with open subtasks cannot close. Close the subtasks first.

## Blockers

Use a blocker when one task must close before another can start. `tix list --ready` leaves out blocked tasks.

```bash
tix block <id> --by <blocker-id>
```

## Close a Task

Close a task immediately after you implement and verify it:

```bash
tix done <id> -r "<result>" --commit HEAD
```

- `--commit` takes a git ref. tix reads the SHA, branch, and message from git.
- Leave out `--commit` for work with no code change, such as a plan or an investigation.

The result must include verification evidence:

- The test command and the pass count.
- The typecheck or lint result.
- What you tested by hand, and what you saw.

Also record decisions, deviations from the plan, and follow-up work. Create a new task for each follow-up.

A good result:

```
Added JWT verification middleware in src/auth/middleware.ts.
Tokens with an expired exp claim return 401. The secret comes from JWT_SECRET.
Decision: verify in middleware, not in each route, so new routes are safe by default.
Verification: pnpm test: 48 passed. pnpm typecheck: no errors.
Manual: curl with an expired token returned 401.
Follow-up: created task for token refresh.
```

A bad result: "Done. Added auth."

## MCP Tools

The tix plugin also starts `tix mcp`. Its tools are `create_task`, `list_tasks`, `show_task`, `update_task`, and `manage_blockers`. They do the same as the CLI. Use the tools or the CLI, whichever is available.
