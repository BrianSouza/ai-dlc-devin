# AI-DLC on Devin

The Devin runtime is a harness distribution for
[Devin CLI](https://docs.devin.ai/cli) and for Devin Desktop, which runs the
same local agent and reads the same `.devin/` project files. It is the same
deterministic core as every other harness — engine, state machine, audit log,
graph, swarm referee and learnings gate are byte-identical — and only the shell
differs. The tree is **generated** into ignored local `dist/devin/` from
`core/` + `harness/devin/` by `bun scripts/package.ts devin`; never hand-edit
it.

> **Fork status.** The Devin harness lives in this fork
> (`BrianSouza/ai-dlc-devin`), not in upstream `awslabs/aidlc-workflows`. The
> upstream native installer and its release files do not carry a `devin`
> runtime, so install with the manual-copy path below.

## Layout

Devin reads its project configuration from `.devin/`
([extensibility docs](https://docs.devin.ai/cli/extensibility)):

| Path | What Devin does with it |
|------|-------------------------|
| `.devin/skills/<name>/SKILL.md` | Skills, typed as `/<name>`: the `/aidlc` orchestrator, `/aidlc-status`, `/aidlc-jump`, `/aidlc-scope`, the session skills and the generated `/aidlc-<stage>` runners (user-only: `triggers: [user]`). |
| `.devin/agents/<name>.md` | The 14 AI-DLC personas as **custom subagent profiles**, dispatched with `run_subagent`. |
| `.devin/rules/*.md` | `aidlc-method.md` (always on: read the org/team/project method), four model-decided `aidlc-phase-*.md` rules, and `aidlc-onboarding.md` (always on). |
| `.devin/hooks.v1.json` | AI-DLC's lifecycle hooks, all routed through `.devin/hooks/aidlc-devin-adapter.ts`. |
| `.devin/config.json` | Project permissions: pre-approves only AI-DLC's own engine commands. |
| `tools/`, `aidlc-common/`, `knowledge/`, `sensors/`, `scopes/`, `hooks/` | The engine; inert data to Devin. |

Beside `.devin/` the install adds the `aidlc/` workspace shell (the method
tree under `aidlc/spaces/default/memory/`), a harness-neutral root
`AGENTS.md` block, and a `.gitignore` block for AI-DLC's local files.

## Prerequisites

- **Devin CLI** — install from <https://cli.devin.ai>, sign in with
  `devin auth login`, and start `devin` **in the project folder**.
- **Bun** — the engine and hooks run on Bun:
  `curl -fsSL https://bun.sh/install | bash`. `bun` must be on the `PATH` of
  the shells Devin starts.
- **A git repository** for the project (`git init` if needed).

## Install (manual copy)

From a checkout of this fork:

```bash
git clone https://github.com/BrianSouza/ai-dlc-devin.git
cd ai-dlc-devin
bun install --frozen-lockfile
bun scripts/package.ts devin        # builds dist/devin/
```

Then copy the tree into your project. `.devin/` and `aidlc/` copy as they
are; merge `AGENTS.md` and `.gitignore` into your own files if you already
have them:

```bash
cd /path/to/your-project
cp -R /path/to/ai-dlc-devin/dist/devin/.devin .
cp -R /path/to/ai-dlc-devin/dist/devin/aidlc .
cat /path/to/ai-dlc-devin/dist/devin/.gitignore >> .gitignore
cat /path/to/ai-dlc-devin/dist/devin/AGENTS.md >> AGENTS.md   # or copy it if you have none
bun .devin/tools/aidlc.ts doctor
```

`doctor` should report the project checks as passing (it warns if `devin` is
not on the `PATH`).

## First run

```text
devin
/aidlc --doctor
/aidlc Build a REST API for inventory management
```

Type `/hooks` in Devin to confirm `.devin/hooks.v1.json` is loaded.

## How the port maps onto Devin

| AI-DLC needs | On Devin |
|--------------|----------|
| Orchestrator skill (`/aidlc`) | `.devin/skills/aidlc/SKILL.md`. Devin delivers what you type after the command with the skill; the skill treats it as `$ARGUMENTS`. |
| Approval gates and questions | **Numbered prose options**, answered with a new message. Devin's `ask_user_question` is not used: an answer given there is not a user prompt, so the human-turn hook would never record it and the gate would refuse. |
| Human-presence evidence | `UserPromptSubmit` → adapter `mint` → core `record-human-turn`. |
| Guards (state transition, reviewer scope, review freeze, plan approval) | `PreToolUse` → adapter `guards`. A refusal is written as `{"decision":"block","reason"}`; an allow writes nothing (an explicit `approve` would skip your own permission prompt). |
| Audit + sensors | `PostToolUse` on `write`, `edit`, `apply_patch`, `notebook_edit`. `apply_patch` is fanned out into one call per file. |
| Stage-graph rebuild | `PostToolUse` on `exec`. |
| Forwarding loop | `Stop` → core `continue-workflow`; Devin's Stop hook can refuse a stop, so a pending step comes back as the next action. |
| Session context | `SessionStart` → `hookSpecificOutput.additionalContext`. |
| Compaction | `PostCompaction` → `validate-state` (Devin has no `PreCompact`). |
| Subagents | `run_subagent` with the persona as profile. Devin sends no subagent identity on hook payloads, so the adapter keeps a dispatch ledger: while a dispatch is live, a call from a session that is not a known top-level one is attributed to the subagent. Subagents cannot spawn subagents. |
| Tool names | The adapter hands Devin's names on as Claude's: `exec`→`Bash`, `read`→`Read`, `write`→`Write`, `edit`→`Edit`, `grep`→`Grep`, `glob`→`Glob`, `run_subagent`→`Task`, `ask_user_question`→`AskUserQuestion`, `todo_write`→`TodoWrite`. |
| Models | Personas ship without `model:`. Devin has no "inherit" value, so each subagent runs on Devin's default subagent model; add `model: opus` (or another name your plan allows) to a persona file to pin one. |

## What's different on Devin

- **No statusline and no welcome message** — use `/aidlc-status` or
  `/aidlc --status`.
- **Construction swarm** runs as subagent fan-out only
  (`AIDLC_USE_SWARM=1` is a loud no-op).
- **Other tools' folders** — Devin CLI imports `.claude/`, `.cursor/`,
  `.kiro/skills/` and other tools' configuration by default. If the project
  also has another AI-DLC install (for example `.claude/`), set
  `"read_config_from": { "claude": false }` in `~/.config/devin/config.json` so
  AI-DLC's hooks do not run twice. `doctor` warns when it sees a `.claude/`
  install next to `.devin/`.
- **Devin Cloud** is not a verified target: cloud sessions take hooks through
  Devin plugins and fire no `SessionEnd`. Run workflows in Devin CLI or Devin
  Desktop; `/handoff` can still send finished work to a cloud session.
- **Plugins** — the packager emits a generic store-kind plugin projection for
  Devin (`dist/plugins/.devin-plugin/`); it has not been checked against
  Devin's own plugin format.

- **Stage rules for subagents** reach them through the brief and the
  persona's read instructions, as on Cursor. Devin's `PreToolUse` can rewrite a
  tool's input (`updatedInput`), so wiring the core `deliver-stage-rules` hook
  for `run_subagent` (as Codex and Copilot do) is a possible follow-up.

## Verification status

Verified in this fork without a live Devin session:

- `bun scripts/package.ts --check` — deterministic for every harness,
  including `devin`, in both the copy and native channels.
- `bun run typecheck` and `bun run lint`.
- `tests/unit/t300-devin-adapter.test.ts` — pipes Devin-shaped payloads
  (per the [lifecycle hooks reference](https://docs.devin.ai/cli/extensibility/hooks/lifecycle-hooks))
  through the packaged adapter: session context wrapper, silent allow,
  subagent attribution and `block` refusals, audit for `write` and
  `apply_patch`.
- `bun .devin/tools/aidlc.ts doctor` on a fresh install, and the engine's
  first steps (`next` → `intent create` → `next`).

Not yet verified: a live Devin CLI run. Devin documents tool names and payload
shapes but not every `tool_input` field (for example `run_subagent`'s and
`edit`'s argument names); the adapter accepts the likely spellings
(`profile`/`subagent_type`, `path`/`file_path`, ...). Capture real payloads
with a temporary `PostToolUse` hook (`matcher: ""`) that logs stdin, and adjust
`normalizeDevinPayload` if a name differs.
