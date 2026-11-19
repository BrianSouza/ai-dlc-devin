// harness/devin/onboarding.fills.ts — Devin CLI's onboarding-doc fills.
// The packager fills core/templates/onboarding-harness.md into the always-on
// dist/devin/.devin/rules/aidlc-onboarding.md, with .devin token projection.
// The root AGENTS.md stays neutral, identical to the other sharing harnesses.

import type { OnboardingFills } from "../../scripts/onboarding.ts";

const fills: OnboardingFills = {
  invoke: "/aidlc",
  slots: {
    frontmatter: "---\ntrigger: always_on\ndescription: AI-DLC onboarding for Devin\n---",
    title_block: `# AI-DLC on Devin

This project uses AI-DLC (AI-Driven Development Life Cycle) for structured development, running on the **Devin harness** (Devin CLI, and Devin Desktop, which runs the same local agent and reads the same \`.devin/\` files). The workspace shell ships in \`.devin/\` (no setup command); describe what you want to build and it sets up the workflow for you. Run \`/aidlc\` followed by a scope or project description to begin. Run \`/aidlc --doctor\` to validate your setup, \`/aidlc --version\` to print the framework version, \`/aidlc --stage <slug>\` to jump to a specific stage, \`/aidlc --phase <name>\` to jump to a phase, \`/aidlc --depth <level>\` to override depth, \`/aidlc --test-strategy <level>\` to override test volume, \`/aidlc --review <class>\` to cap stage reviews (adversarial, advisory, none). Devin shortcut skills expose \`/aidlc-status\`, \`/aidlc-jump --stage <slug>\` (or \`--phase <name>\`), and \`/aidlc-scope <name>\` through the same workflow. Run \`/aidlc compose "<task>"\` to get a plan tailored to that task (works up front, from a scan report via \`--report <path>\`, and mid-workflow to re-shape the pending stages - every proposal stops at an approve/edit/reject gate).`,

    prereq_bullets: `- **Devin CLI** (\`devin\`; install from https://cli.devin.ai and sign in with \`devin auth login\`). It reads this install's \`.devin/\` surfaces: \`.devin/skills/\` (the \`/aidlc\` skills), \`.devin/agents/\` (the expert roles as custom subagents), \`.devin/rules/\` (standing practices), \`.devin/hooks.v1.json\` (AI-DLC's hooks) and \`.devin/config.json\` (permissions). Start \`devin\` in the project folder.
- **bun**: Required for the CLI tools and hook scripts (tracking progress, writing the decision log, deciding what runs next). Install via \`curl -fsSL https://bun.sh/install | bash\`. \`bun\` must be on your PATH for the shells Devin spawns.
- **Permissions**: the shipped \`.devin/config.json\` pre-approves only AI-DLC's own workflow commands so the forwarding loop's engine calls do not prompt; every other shell command follows your Devin permission mode. Gated workflows need an interactive session: an approval gate needs a real message from you.
- **Other tools' folders**: Devin CLI also imports \`.claude/\`, \`.cursor/\` and other tools' configuration by default. If this project also carries another AI-DLC install (for example \`.claude/\`), turn that import off in your user config (\`read_config_from\`), so AI-DLC's hooks do not run twice.`,

    prereq_bullets_tail: "",

    agents_note: `On Devin each expert role is a custom subagent profile (the persona files in \`.devin/agents/\`); the \`/aidlc\` session takes on those roles itself for most stages and hands work off via the \`run_subagent\` tool. They ship without \`model:\` pins, so each subagent runs on Devin's default subagent model unless you add one.`,

    structure_extra: "",

    sections_before_resumption: `## What's different on this harness

This is the same AI-DLC core that ships to every harness: the same ordered steps, the same approval gates, and the same written record of what was decided, rendered onto Devin. On Devin:

- Approval gates and questions render as **numbered prose options**; your reply is a new message, which is what records your turn for the gate. The questions FILE with \`[Answer]:\` tags remains the source of truth.
- Hooks ride \`.devin/hooks.v1.json\` through the AIDLC adapter (\`.devin/hooks/aidlc-devin-adapter.ts\`), which hands Devin's tool names (\`exec\`, \`edit\`, \`write\`, \`apply_patch\`, \`run_subagent\`, ...) on to the shared core hooks: state-transition, reviewer read-scope, review-freeze, and plan-approval guards block before tools; audit and sensors cover writes and edits; stage-graph rebuilds, human-turn recording, and post-compaction state validation run from the matching Devin events.
- The forwarding loop is enforced by Devin's Stop hook, which can refuse a stop while a step is pending.
- The AI-DLC method (\`aidlc/spaces/<space>/memory/*.md\`) reaches context through read instructions: \`.devin/rules/aidlc-method.md\` always points to org/team/project, while four model-decided \`.devin/rules/aidlc-phase-*.md\` files point to phase guidance only when relevant. The SessionStart hook separately injects live workflow state.
- Subagent identity on hook payloads is **reconstructed by the adapter** (Devin sends no per-subagent identity): reviewer read-scope enforcement keys on the dispatch ledger the adapter keeps.
- There is **no statusline** and **no welcome message**; use \`/aidlc-status\` (or \`/aidlc --status\`) and the progress lines at gates.
- Construction swarm runs as **subagent fan-out only** (\`AIDLC_USE_SWARM=1\` is a loud no-op).
- **Devin Cloud** is not a verified target of this port: cloud sessions take hooks through Devin plugins and fire no SessionEnd, so run AI-DLC workflows in Devin CLI or Devin Desktop (hand finished work to the cloud with \`/handoff\` if you like).
- **MCP servers**: none ship (configure your own in \`.devin/mcp_config.json\` if needed).
`,

    sections_after_resumption: "",
  },
};

export default fills;
