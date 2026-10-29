# tix setup. Run `just` to list the recipes.

set dotenv-load

# The Convex team slug. Set TIX_TEAM in .env, or run `just team=<slug> <recipe>`.
team := env("TIX_TEAM", "")
project := "tix"
convex := "bunx convex"

# List the recipes
default:
    @just --list

# Backend, once: log in, link, and deploy to production
setup: check-login check-team link deploy

# Stop if the Convex CLI is not logged in
check-login:
    #!/usr/bin/env bash
    set -euo pipefail
    status=$({{convex}} login status 2>&1)
    if ! grep -q '^Status: Logged in' <<<"$status"; then
      echo "Not logged in to Convex. Run: {{convex}} login" >&2
      exit 1
    fi

# Stop if the Convex login cannot reach the tix team
check-team: check-login
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -z "{{team}}" ]; then
      echo "Set TIX_TEAM=<team slug> in .env, or run: just team=<team slug> setup" >&2
      exit 1
    fi
    status=$({{convex}} login status 2>&1)
    if ! grep -qF '({{team}})' <<<"$status"; then
      echo "This Convex login cannot reach team {{team}}." >&2
      echo "Run {{convex}} logout, then {{convex}} login with the account that owns {{team}}." >&2
      exit 1
    fi

# Link this directory to the tix project. Creates the project if it does not exist
link: check-team
    #!/usr/bin/env bash
    set -euo pipefail
    if grep -qF 'team: {{team}}, project: {{project}}' .env.local 2>/dev/null; then
      echo "Already linked to {{team}}/{{project}}"
      exit 0
    fi
    configure() {
      {{convex}} dev --once --configure existing --team {{team}} --project {{project}} --dev-deployment cloud
    }
    if ! configure; then
      {{convex}} project create {{project}} --team {{team}}
      configure
    fi

# Deploy the backend to production and print the production URL
deploy: link
    {{convex}} deploy --yes --cmd 'echo "Production URL: $TIX_URL"' --cmd-url-env-var-name TIX_URL

# Make a token for one machine. Convex shows the token once
token NAME: link
    {{convex}} run --prod tokens:create '{"name":"{{NAME}}"}'

# Revoke the token of one machine
revoke NAME: link
    {{convex}} run --prod tokens:revoke '{"name":"{{NAME}}"}'

# List the machine tokens
tokens: link
    {{convex}} run --prod tokens:list

# Each machine: put tix on the PATH
install:
    bun install --frozen-lockfile
    /bin/mkdir -p ~/.local/bin
    /bin/ln -sfn {{justfile_directory()}}/src/index.ts ~/.local/bin/tix
    @echo "Installed ~/.local/bin/tix. Next: tix login --url <url> --token <token>"

# Each machine: install the tix skills and MCP server in Claude Code
agent:
    #!/usr/bin/env bash
    set -euo pipefail
    marketplaces=$(claude plugin marketplace list --json)
    if ! grep -q '"name": "tix"' <<<"$marketplaces"; then
      claude plugin marketplace add {{justfile_directory()}}
    fi
    plugins=$(claude plugin list --json)
    if ! grep -q '"tix@tix"' <<<"$plugins"; then
      claude plugin install tix@tix --scope user
    fi
