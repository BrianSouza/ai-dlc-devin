#!/usr/bin/env bun
// scripts/install-devin-config.ts — keeps a team's own .devin/config.json
// across scripts/install-devin.sh.
//
// `aidlc config --harness devin` owns .devin/config.json whole and refuses a
// file it did not write (the conflict a team with its own Devin permissions
// would hit). The installer therefore sets the team's file aside, lets config
// write AI-DLC's, and merges the team's back in:
//   save <project> <stash>     move .devin/config.json to <stash> (if present)
//   restore <project> <stash>  merge <stash> into the config AI-DLC wrote
// The merge keeps every key the team set; string lists under `permissions`
// become the union (team entries first), and plugin lists gain the team's
// entries AI-DLC does not already carry.

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Devin's config files allow comments and trailing commas.
function parseJsonc(text: string, label: string): Json {
  const value = Bun.JSONC.parse(text) as unknown;
  if (!isObject(value)) throw new Error(`${label} is not a JSON object`);
  return value;
}

function union(team: unknown[], ours: unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const item of [...team, ...ours]) {
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function mergeTeamConfig(ours: Json, team: Json): Json {
  const merged: Json = { ...ours };
  for (const [key, value] of Object.entries(team)) {
    const shipped = ours[key];
    if (key === "permissions" && isObject(value) && isObject(shipped)) {
      const permissions: Json = { ...shipped };
      for (const [rule, list] of Object.entries(value)) {
        const own = shipped[rule];
        permissions[rule] = Array.isArray(list) && Array.isArray(own) ? union(list, own) : list;
      }
      merged[key] = permissions;
    } else if (/Plugins$/.test(key) && Array.isArray(value) && Array.isArray(shipped)) {
      merged[key] = union(value, shipped);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function main(argv: string[]): void {
  const [mode, project, stash] = argv;
  if ((mode !== "save" && mode !== "restore") || !project || !stash) {
    console.error("usage: install-devin-config.ts save|restore <project> <stash>");
    process.exit(2);
  }
  const config = join(project, ".devin", "config.json");
  if (mode === "save") {
    if (!existsSync(config)) return;
    mkdirSync(dirname(stash), { recursive: true });
    renameSync(config, stash);
    return;
  }
  if (!existsSync(stash)) return;
  const team = parseJsonc(readFileSync(stash, "utf-8"), "your .devin/config.json");
  const ours = existsSync(config) ? parseJsonc(readFileSync(config, "utf-8"), ".devin/config.json") : {};
  writeFileSync(config, `${JSON.stringify(mergeTeamConfig(ours, team), null, 2)}\n`);
  rmSync(stash, { force: true });
}

if (import.meta.main) main(process.argv.slice(2));
