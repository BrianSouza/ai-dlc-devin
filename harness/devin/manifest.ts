// harness/devin/manifest.ts — the Devin CLI distribution row.
//
// Projects the harness-neutral core/ tree into dist/devin/.devin/. Devin CLI
// (and Devin Desktop, which runs the same local agent) reads its project
// configuration from .devin/ (docs.devin.ai/cli/extensibility):
//   - .devin/skills/<name>/SKILL.md   skills, invoked as /<name>
//   - .devin/agents/<name>.md         custom subagent profiles (run_subagent)
//   - .devin/rules/*.md               rules with `trigger` frontmatter
//   - .devin/hooks.v1.json            lifecycle hooks (Claude Code compatible)
//   - .devin/config.json              project permissions
// The engine dirs (tools/, aidlc-common/, knowledge/, sensors/, scopes/,
// hooks/) are inert data to Devin and share the directory, as on Cursor.
//
// Devin specifics vs Claude/Cursor:
//   - token → .devin. Core persona .md files land in .devin/agents/, where
//     Devin reads them as custom subagents: its frontmatter (name,
//     description, model, allowed-tools) is a subset of core's, so they ship
//     as projected (no model pin: Devin has no "inherit" value, and an
//     unpinned profile runs on Devin's default subagent model).
//   - skills: the orchestrator plus three shortcut skills are authored here;
//     the generated stage runners land in .devin/skills/ through the standard
//     runner-gen step, user-only (`triggers: [user]`) because they change
//     workflow state.
//   - rules: Devin rules do not expand @-imports, so .devin/rules/aidlc-method.md is
//     a READ instruction naming aidlc/active-memory/ (the Cursor pattern),
//     with four model-decided phase rules beside it.
//   - hooks: .devin/hooks.v1.json wires Devin's events to
//     aidlc-devin-adapter.ts, which hands Devin's tool names on as Claude's
//     and runs the byte-shared core hooks.
//   - questions render as numbered prose (an ask_user_question answer is not
//     a user prompt, so it would never be recorded as the person's turn).
import type { HarnessManifest } from "../../scripts/manifest-types.ts";
import onboardingFills from "./onboarding.fills.ts";

const manifest: HarnessManifest = {
  name: "devin",
  productName: "Devin CLI",
  configNextStep: "start `devin` in this project (if it is already running in this folder, exit it and start it again) and run `/aidlc --doctor`",
  // Devin sets DEVIN_PROJECT_DIR for its hooks; its shell tool is not
  // documented to mark the commands it runs, so no host-shell variable is
  // claimed here.
  hookActivation: {
    recovery:
      "Exit Devin and start it again in this folder, then type <entry>. If it still runs none of AI-DLC's hooks, " +
      "type /hooks in Devin to see which hook files it loaded; .devin/hooks.v1.json must be among them.",
    notRunYet:
      "This is expected before your first Devin session in this folder. If you already started one, type /hooks in " +
      "Devin to check that .devin/hooks.v1.json is loaded, then exit Devin, start it again in this folder, and run " +
      "doctor again.",
    startedInsideProject:
      "AI-DLC's hooks work only when Devin is started in the project folder. Exit Devin, start it again in " +
      "<folder>, then type <entry>.",
  },
  // A clean chat for new work started beside other work.
  newChatStep: { text: "exit Devin and start it again in this folder (or type /clear), then type <entry>" },
  harnessDir: ".devin",
  orchestratorSkillPath: ".devin/skills/aidlc/SKILL.md",
  tierFlavor: "devin",
  rootIntegrations: [
    {
      path: ".gitignore",
      policy: "managed-block",
      marker: "gitignore",
      shared: "union",
    },
    {
      path: "AGENTS.md",
      policy: "managed-block",
      marker: "agents",
      shared: "identical",
    },
  ],

  // Same core projection as Claude and Cursor, into .devin/.
  coreDirs: [
    { src: "tools", dst: "tools" },
    { src: "aidlc-common", dst: "aidlc-common" },
    { src: "knowledge", dst: "knowledge" },
    { src: "sensors", dst: "sensors" },
    { src: "scopes", dst: "scopes" },
    { src: "agents", dst: "agents" },
    { src: "hooks", dst: "hooks" },
    { src: "skills/aidlc-session-cost", dst: "skills/aidlc-session-cost" },
    { src: "skills/aidlc-replay", dst: "skills/aidlc-replay" },
    { src: "skills/aidlc-outcomes-pack", dst: "skills/aidlc-outcomes-pack" },
    { src: "skills/aidlc-issue-report", dst: "skills/aidlc-issue-report" },
    { src: "skills/aidlc-knowledge", dst: "skills/aidlc-knowledge" },
  ],

  harnessFiles: [
    // The orchestrator skill — Devin's native layout, /aidlc invocation.
    { src: "skills/aidlc/SKILL.md", dst: "skills/aidlc/SKILL.md" },
    { src: "skills/aidlc/question-rendering.md", dst: "skills/aidlc/question-rendering.md" },
    { src: "skills/aidlc/composer.md", dst: "skills/aidlc/composer.md" },
    { src: "skills/aidlc/tables.md", dst: "skills/aidlc/tables.md" },
    // Shortcut skills: /aidlc-status, /aidlc-jump, /aidlc-scope.
    { src: "skills/aidlc-status/SKILL.md", dst: "skills/aidlc-status/SKILL.md" },
    { src: "skills/aidlc-jump/SKILL.md", dst: "skills/aidlc-jump/SKILL.md" },
    { src: "skills/aidlc-scope/SKILL.md", dst: "skills/aidlc-scope/SKILL.md" },
    // AIDLC method pointers: standing layers always apply; phase guidance is
    // model-decided. Each carries a READ instruction naming
    // aidlc/active-memory/ (aidlc-includes.ts refreshActiveMemory).
    { src: "rules-aidlc-method.md", dst: "rules/aidlc-method.md" },
    { src: "rules-aidlc-phase-ideation.md", dst: "rules/aidlc-phase-ideation.md" },
    { src: "rules-aidlc-phase-inception.md", dst: "rules/aidlc-phase-inception.md" },
    { src: "rules-aidlc-phase-construction.md", dst: "rules/aidlc-phase-construction.md" },
    { src: "rules-aidlc-phase-operation.md", dst: "rules/aidlc-phase-operation.md" },
    // The hook shim + wiring (the adapter is authored; the core hook bodies
    // beside it are packaged byte-identical to the Claude harness).
    { src: "hooks/aidlc-devin-adapter.ts", dst: "hooks/aidlc-devin-adapter.ts" },
    { src: "hooks.v1.json", dst: "hooks.v1.json" },
    // Project permissions: pre-approve AI-DLC's own workflow commands so the
    // forwarding loop is not interrupted by a prompt per engine call. The
    // packager expands the one tool glob into exact Exec() prefixes.
    { src: "config.json", dst: "config.json" },
    { src: "dot-gitignore", dst: ".gitignore", projectRoot: true },
  ],

  // AGENTS.md at the project root — Devin reads it as always-on project rules
  // (no @-import expansion); the Devin-specific onboarding is an always-on
  // rule in .devin/rules/.
  onboarding: { dst: "AGENTS.md", projectRoot: true, harnessDst: "rules/aidlc-onboarding.md", fills: onboardingFills },

  // .devin/rules/ is Devin's native rules dir and our stubs live there; core
  // projects no rules/ dir, so nothing needs renaming.
  rulesRename: null,

  // Runners generate into .devin/skills/ and stay user-only: the agent must
  // not start a state-changing stage runner on its own.
  runnerFrontmatterAdditions: ["triggers: [user]"],

  emit: null,

  // The standing rule names the doctor the way each install runs it: a copied
  // install through its own Bun dispatcher, the native release as `aidlc`.
  nativeReplacements: [{
    from: "run `bun .devin/tools/aidlc.ts doctor` (after installing Bun from https://bun.sh/install if `bun` is not found),",
    to: "run `aidlc doctor`,",
  }],
};

export default manifest;
