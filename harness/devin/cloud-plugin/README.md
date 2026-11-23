# aidlc-devin: the Devin Cloud plugin

This folder is a Devin plugin (`.devin-plugin/plugin.json`). It loads only in
Devin Cloud sessions (`"platforms": ["cloud"]`), so Devin CLI and Devin Desktop
keep running AI-DLC from the project's own `.devin/` files with nothing loaded
twice.

It carries no copy of AI-DLC. It runs the AI-DLC Devin install committed in
the repository the session cloned:

- `hooks.json` runs that install's `.devin/hooks/aidlc-devin-adapter.ts` for
  each Devin event. Devin Cloud also runs the repository's
  `.devin/hooks.v1.json` when it was there at session start; those hooks
  leave a mark when they run, and the plugin's hooks then step aside, so each
  hook runs once. An install made during the session gets the plugin's hooks;
- `skills/aidlc` finds the install and hands over to its conductor skill;
- `AGENTS.md` points sessions at the install's standing method rule.

Install it from Devin's Customize page (Plugins, Add plugin, From repository:
this repository, subdirectory `harness/devin/cloud-plugin`) or declare it in
the project's `.devin/config.json`. The full steps are in
`docs/guide/harnesses/devin.md`, section "Devin Cloud".
