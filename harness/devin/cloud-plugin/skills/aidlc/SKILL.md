---
name: aidlc
description: >
  Start or resume an AI-DLC workflow (AI-Driven Development Life Cycle) in a
  repository that carries an AI-DLC Devin install. Describe what to build, or
  pass --status, --doctor, --stage <slug>, --phase <name>, --scope <name>,
  --help.
argument-hint: "[description | --status | --doctor | --stage <slug|#> | --phase <name|#> | --help]"
triggers: ["user"]
---

# AI-DLC (Devin Cloud)

`$ARGUMENTS` is what the person typed after the skill name.

1. Find the repository in this session that has `.devin/skills/aidlc/SKILL.md`
   (AI-DLC's Devin install). Work from that repository's root for every
   AI-DLC command. If no cloned repository has it, tell the person in one line
   that AI-DLC is not installed in these repositories, point them to
   `docs/guide/harnesses/devin.md` in the ai-dlc-devin repository for the
   install, and stop.
2. Read that repository's `.devin/skills/aidlc/SKILL.md` in full, together
   with the files it names beside it (`question-rendering.md`, `composer.md`,
   `tables.md`) when it tells you to, and follow it exactly with
   `$ARGUMENTS`. It is the conductor; this file only finds it.
3. Run `bun --version` once. If Bun is missing, tell the person in one line
   that AI-DLC needs Bun in the Devin environment (blueprint
   `initialize: curl -fsSL https://bun.sh/install | bash`), and stop.

On Devin Cloud, custom subagent profiles are not loaded. When the conductor
dispatches an AI-DLC agent with `run_subagent` and its profile is not
available, follow the conductor's Devin Cloud note for the fallback.
