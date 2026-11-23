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
> runtime, so install with this fork's one-command installer below.

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

## Install

In the project folder (a git repository), run:

```bash
curl -fsSL https://raw.githubusercontent.com/BrianSouza/ai-dlc-devin/main/scripts/install-devin.sh | sh
```

The installer (`scripts/install-devin.sh`):

1. installs Bun when it is missing;
2. downloads this repository and builds the Devin runtime from it;
3. runs the same `aidlc config --harness devin` every harness uses, which
   adds AI-DLC's block to `AGENTS.md` and `.gitignore` without touching your
   own lines, keeps any AI-DLC work already under `aidlc/`, and records what it
   wrote so a later run refreshes only AI-DLC's files;
4. keeps your own `.devin/config.json`, merging your permissions and plugins
   with AI-DLC's;
5. runs `doctor`.

Run the same command again to update. Options go after `sh -s --`:

| Option | Meaning |
|--------|---------|
| `--ref <branch\|tag>` | Install another ref of this repository (default `main`) |
| `--repo <owner/name>` | Install from your own fork of this repository |
| `--project <dir>` | Install into another folder than the current one |
| `--force` | Let the refresh replace AI-DLC files you edited |

For example, to pin a tag: `curl -fsSL …/install-devin.sh | sh -s -- --ref v2.11.4`.
The installer runs on macOS, Linux and WSL.

### Manual install

To build it yourself instead: clone this repository, run
`bun install --frozen-lockfile` and
`bun scripts/package-release.ts --copy-runtime-only --output build/devin`, then
in your project run
`bun /path/to/ai-dlc-devin/dist/devin/.devin/tools/aidlc.ts config --harness devin --yes --from /path/to/ai-dlc-devin/build/devin/aidlc-copy-runtime-<version>.tar.gz`.

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
- **Devin Cloud** runs AI-DLC through the `aidlc-devin` cloud plugin; see
  [Devin Cloud](#devin-cloud) below for what changes there.
- **Plugins** — the packager emits a generic store-kind plugin projection for
  Devin (`dist/plugins/.devin-plugin/`); it has not been checked against
  Devin's own plugin format.

- **Stage rules for subagents** reach them through the brief and the
  persona's read instructions, as on Cursor. Devin's `PreToolUse` can rewrite a
  tool's input (`updatedInput`), so wiring the core `deliver-stage-rules` hook
  for `run_subagent` (as Codex and Copilot do) is a possible follow-up.

## Devin Cloud

Devin Cloud sessions (the web app, Slack, automations, `devin --cloud`) are
not the Devin CLI on a VM: they run Devin's cloud agent, which reads a
repository's `AGENTS.md` and skills, runs the repository's
`.devin/hooks.v1.json`, and loads no custom subagent profiles. AI-DLC reaches them through a small plugin
in this repository, `harness/devin/cloud-plugin/` (`aidlc-devin`):

- it loads **only in cloud sessions** (`"platforms": ["cloud"]`), so Devin CLI
  and Devin Desktop keep using the project's own `.devin/` files and nothing
  runs twice;
- it carries no copy of AI-DLC: its `hooks.json` runs the adapter of the
  AI-DLC install in the cloned repository whenever Devin did not load that
  install's own hooks: an install made during the session, or an older one.
  Once the install's own hooks run, they leave a mark and the plugin's hooks
  step aside, so nothing runs twice. Its `aidlc` skill hands
  over to that install's `/aidlc` conductor skill, and its `AGENTS.md` points
  the session at the install's method rule.

### Install for Devin Cloud

1. **Commit the install to the project.** Install AI-DLC in the project as in
   [Install](#install), then commit `.devin/`, `aidlc/`, `AGENTS.md` and
   `.gitignore` and push. A cloud session only sees what the repository holds.
2. **Give Devin the repository.** In Devin, *Settings → Repositories*, grant
   access to the project repository and to this fork (the plugin's source).
3. **Bun.** A cloud VM starts without Bun. The first AI-DLC hook that runs
   installs it (into `~/.bun`, once, while the others wait) when the
   session's project is a cloned repository under `~/repos/`, and every hook
   looks for it in `~/.bun/bin`, because a hook's shell does not read
   `~/.bashrc`. Where Bun cannot be installed, the hooks do nothing instead of
   failing. Installing it takes a few seconds at the start of each session; to
   have Bun from the start, add it to the repository's environment
   blueprint ([Devin environment setup](https://docs.devin.ai/onboard-devin/environment);
   Devin can also write it for you):

   ```yaml
   initialize: |
     curl -fsSL https://bun.sh/install | bash
   ```

4. **The plugin is already declared.** The installed `.devin/config.json`
   lists the `aidlc-devin` plugin in `requiredPlugins`, so every cloud session
   on the repository installs it. To install it for every repository instead,
   use *Customize → Plugins → Add plugin → From repository*:
   `BrianSouza/ai-dlc-devin`, subdirectory `harness/devin/cloud-plugin`. (The
   plugin loads only in cloud sessions, so Devin CLI and Desktop ignore it.)
5. **Start a cloud session** on the repository and type
   `@skills:aidlc Build a REST API for inventory management` (or
   `/aidlc-devin:aidlc ...` from `devin --cloud`).

### What differs in the cloud

- **Hooks are best effort.** Devin runs plugin hooks fail-open: if one fails
  to load or run, the session carries on without it. AI-DLC's guards can then
  not stop a call, and the conductor keeps to the step the engine gives it.
  The SessionStart hook runs in the background (its context arrives on the
  next turn) and there is no SessionEnd.
- **Approval gates** still need your own message: answer each question in the
  chat. If the UserPromptSubmit hook does not run, a gate refuses the approval
  rather than assuming it.
- **Subagents.** Cloud sessions load no custom subagent profiles, so the
  conductor sends an AI-DLC agent as Devin's general subagent with
  `AIDLC persona: <agent>` and the persona at the top of the brief; the hooks
  read the agent from that line.
- **One install per session.** The plugin's hooks act on the first cloned
  repository that carries `.devin/hooks.v1.json` (under `~/repos/`); keep one
  AI-DLC repository per cloud session.
- **Duplicate events.** If a cloud session also reads the project's
  `.devin/hooks.v1.json`, each event reaches the adapter twice; the adapter
  answers the first and replays that answer for the second.

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
- The cloud plugin: its targets match `.devin/hooks.v1.json`, it loads only in
  cloud sessions, its launcher finds an install under `~/repos/<repo>` and runs
  the adapter (and stays silent with no install), duplicate deliveries replay
  one answer, and a general-profile dispatch is attributed to the persona its
  brief names (`t300`).

Not yet verified: a live Devin CLI run, and a live Devin Cloud session. Devin documents tool names and payload
shapes but not every `tool_input` field (for example `run_subagent`'s and
`edit`'s argument names); the adapter accepts the likely spellings
(`profile`/`subagent_type`, `path`/`file_path`, ...). Capture real payloads
with a temporary `PostToolUse` hook (`matcher: ""`) that logs stdin, and adjust
`normalizeDevinPayload` if a name differs.
