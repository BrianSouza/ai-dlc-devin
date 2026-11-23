# aidlc-devin: the Devin Cloud plugin

This folder is a Devin plugin (`.devin-plugin/plugin.json`). It loads only in
Devin Cloud sessions (`"platforms": ["cloud"]`), so Devin CLI and Devin Desktop
keep running AI-DLC from the project's own `.devin/` files with nothing loaded
twice.

It carries no copy of AI-DLC. It runs the AI-DLC Devin install committed in
the repository the session cloned:

- `hooks.json` runs that install's `.devin/hooks/aidlc-devin-adapter.ts` for
  each Devin event when the install's own hooks cannot. Devin Cloud also runs
  the repository's `.devin/hooks.v1.json`, and a current install's hooks find
  Bun themselves, so for those the plugin's hooks step aside and each hook
  runs once;
- `skills/aidlc` finds the install and hands over to its conductor skill;
- `AGENTS.md` points sessions at the install's standing method rule.

Install it from Devin's Customize page (Plugins, Add plugin, From repository:
this repository, subdirectory `harness/devin/cloud-plugin`) or declare it in
the project's `.devin/config.json`. The full steps are in
`docs/guide/harnesses/devin.md`, section "Devin Cloud".
