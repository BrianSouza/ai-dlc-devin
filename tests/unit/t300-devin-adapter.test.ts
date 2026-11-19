// t300-devin-adapter: the Devin CLI hook shim. Unit-level checks of the
// payload normalization (Devin tool names -> the Claude names the core hooks
// key on, apply_patch fan-out), then Devin-shaped payloads piped through the
// packaged adapter in a scratch project built from dist/devin, asserting the
// Devin output contract on the wire:
//   - SessionStart context rides hookSpecificOutput.additionalContext.
//   - An allow is silence (never {"decision":"approve"}, which would skip the
//     person's own permission prompt).
//   - A core guard refusal becomes {"decision":"block","reason"} on stdout.
//   - run_subagent opens the identity ledger, so a call from another session
//     is attributed to the subagent while it runs; PostToolUse closes it.
//   - write/apply_patch PostToolUse feed the audit (ARTIFACT_*).
//
// covers: hook:aidlc-state-transition-guard, hook:aidlc-write-audit-log

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyPatchFiles,
  normalizeDevinPayload,
} from "../../dist/devin/.devin/hooks/aidlc-devin-adapter.ts";

setDefaultTimeout(240_000);

const REPO_ROOT = join(import.meta.dir, "..", "..");
const DEVIN_DIST = join(REPO_ROOT, "dist", "devin");

describe("normalizeDevinPayload", () => {
  test("maps Devin tool names to the Claude names the core hooks key on", () => {
    const pairs: Array<[string, string]> = [
      ["exec", "Bash"],
      ["read", "Read"],
      ["write", "Write"],
      ["edit", "Edit"],
      ["grep", "Grep"],
      ["glob", "Glob"],
      ["webfetch", "WebFetch"],
      ["ask_user_question", "AskUserQuestion"],
      ["todo_write", "TodoWrite"],
      ["run_subagent", "Task"],
      ["mcp__github__create_issue", "mcp__github__create_issue"],
    ];
    for (const [devin, claude] of pairs) {
      expect(normalizeDevinPayload({ tool_name: devin, tool_input: {} }).tool_name).toBe(claude);
    }
  });

  test("copies a path argument into file_path and names the session as the conversation", () => {
    const out = normalizeDevinPayload({ session_id: "s1", tool_name: "edit", tool_input: { path: "src/a.ts" } });
    expect(out.tool_input?.file_path).toBe("src/a.ts");
    expect(out.conversation_id).toBe("s1");
    const kept = normalizeDevinPayload({ tool_name: "write", tool_input: { file_path: "b.ts", path: "other.ts" } });
    expect(kept.tool_input?.file_path).toBe("b.ts");
  });

  test("run_subagent carries its profile as subagent_type and its task as prompt", () => {
    const out = normalizeDevinPayload({
      session_id: "s1",
      prompt_id: "p1",
      tool_name: "run_subagent",
      tool_input: { profile: "aidlc-quality-agent", task: "run the tests" },
    });
    expect(out.tool_input?.subagent_type).toBe("aidlc-quality-agent");
    expect(out.tool_input?.prompt).toBe("run the tests");
    expect(out.tool_use_id).toBe("p1:aidlc-quality-agent");
  });
});

describe("applyPatchFiles", () => {
  test("lists each file of an apply_patch call as the Claude tool it amounts to", () => {
    const patch = [
      "*** Begin Patch",
      "*** Add File: new.md",
      "+hi",
      "*** Update File: src/old.ts",
      "+x",
      "*** Delete File: gone.txt",
      "*** End Patch",
    ].join("\n");
    expect(applyPatchFiles({ tool_name: "apply_patch", tool_input: { patch } })).toEqual([
      { tool: "Write", path: "new.md" },
      { tool: "Edit", path: "src/old.ts" },
      { tool: "Delete", path: "gone.txt" },
    ]);
    expect(applyPatchFiles({ tool_name: "edit", tool_input: {} })).toBeNull();
  });
});

describe("Devin adapter on the wire", () => {
  let project = "";
  let intentDir = "";
  const adapter = () => join(project, ".devin", "hooks", "aidlc-devin-adapter.ts");
  const env = () => ({ ...process.env, DEVIN_PROJECT_DIR: project, AIDLC_PROJECT_DIR: project });

  function hook(target: string, payload: Record<string, unknown>): { stdout: string; code: number } {
    const r = spawnSync(process.execPath, [adapter(), target], {
      cwd: project,
      env: env(),
      input: JSON.stringify(payload),
      encoding: "utf-8",
    });
    return { stdout: r.stdout ?? "", code: r.status ?? 1 };
  }

  function engine(args: string[]): string {
    const r = spawnSync(process.execPath, [join(project, ".devin", "tools", "aidlc.ts"), ...args], {
      cwd: project,
      env: env(),
      encoding: "utf-8",
    });
    return `${r.stdout ?? ""}${r.stderr ?? ""}`;
  }

  beforeAll(() => {
    expect(existsSync(join(DEVIN_DIST, ".devin", "hooks.v1.json"))).toBe(true);
    project = mkdtempSync(join(tmpdir(), "aidlc-devin-adapter-"));
    cpSync(DEVIN_DIST, project, { recursive: true });
    spawnSync("git", ["init", "-q"], { cwd: project });
    hook("session-start", { hook_event_name: "SessionStart", source: "startup", session_id: "main-1" });
    hook("mint", {
      hook_event_name: "UserPromptSubmit",
      session_id: "main-1",
      prompt_id: "p1",
      prompt: "/aidlc express add a hello CLI",
    });
    const offer = engine(["engine", "orchestrate", "next", "express", "add a hello CLI"]);
    const request = /--request (\S+)/.exec(offer)?.[1];
    expect(request).toBeDefined();
    engine(["engine", "intent", "create", "--scope", "express", "--request", request as string, "--label", "hello-cli"]);
    const intents = join(project, "aidlc", "spaces", "default", "intents");
    const record = readdirSync(intents).find((name) => /^\d{6}-hello-cli$/.test(name));
    expect(record).toBeDefined();
    intentDir = join(intents, record as string);
    // express stands its guards aside; the delegate checks below need them up.
    // The engine binds the change to the person's message the mint recorded.
    const ask = engine(["engine", "orchestrate", "next", "--guard-policy", "strict"]);
    const message = /\(([0-9a-f]{8}), sent/.exec(ask)?.[1];
    expect(message).toBeDefined();
    expect(engine(["engine", "config", "set", "guard-policy", "strict", "--message", message as string])).toContain(
      "strict",
    );
  });

  afterAll(() => {
    if (project) rmSync(project, { recursive: true, force: true });
  });

  test("SessionStart context rides hookSpecificOutput", () => {
    const r = hook("session-start", { hook_event_name: "SessionStart", source: "resume", session_id: "main-1" });
    expect(r.code).toBe(0);
    const out = JSON.parse(r.stdout) as {
      hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
    };
    expect(out.hookSpecificOutput?.hookEventName).toBe("SessionStart");
    expect(out.hookSpecificOutput?.additionalContext).toContain("main-1");
  });

  test("an allowed call is silence, never an approve decision", () => {
    const r = hook("guards", {
      hook_event_name: "PreToolUse",
      session_id: "main-1",
      prompt_id: "p2",
      tool_name: "exec",
      tool_input: { command: "ls -la" },
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("");
  });

  test("a subagent is attributed while it runs and refused the main session's routing", () => {
    const dispatch = {
      hook_event_name: "PreToolUse",
      session_id: "main-1",
      prompt_id: "p3",
      tool_name: "run_subagent",
      tool_input: { profile: "aidlc-developer-agent", task: "scan the code" },
    };
    expect(hook("guards", dispatch).stdout).toBe("");

    const routed = hook("guards", {
      hook_event_name: "PreToolUse",
      session_id: "sub-1",
      prompt_id: "q1",
      tool_name: "exec",
      tool_input: { command: "bun .devin/tools/aidlc.ts engine orchestrate next" },
    });
    const block = JSON.parse(routed.stdout) as { decision?: string; reason?: string };
    expect(block.decision).toBe("block");
    expect(block.reason).toContain("aidlc-developer-agent");

    const nested = JSON.parse(
      hook("guards", {
        hook_event_name: "PreToolUse",
        session_id: "sub-1",
        prompt_id: "q1",
        tool_name: "run_subagent",
        tool_input: { profile: "aidlc-quality-agent", task: "x" },
      }).stdout,
    ) as { decision?: string; reason?: string };
    expect(nested.decision).toBe("block");
    expect(nested.reason).toContain("nested delegation");

    hook("audit-and-sensors", {
      ...dispatch,
      hook_event_name: "PostToolUse",
      tool_response: { success: true, output: "done", error: null },
    });
    const after = hook("guards", {
      hook_event_name: "PreToolUse",
      session_id: "sub-1",
      prompt_id: "q2",
      tool_name: "exec",
      tool_input: { command: "bun .devin/tools/aidlc.ts engine orchestrate next" },
    });
    expect(after.stdout).toBe("");
  });

  test("write and apply_patch feed the audit", () => {
    const rel = join("inception", "requirements-analysis", "requirements.md");
    const file = join(intentDir, rel);
    mkdirSync(join(intentDir, "inception", "requirements-analysis"), { recursive: true });
    writeFileSync(file, "# Requirements\n");
    const relFromProject = file.slice(project.length + 1);
    const audit = () =>
      readdirSync(join(intentDir, "audit")).map((name) => readFileSync(join(intentDir, "audit", name), "utf-8")).join(
        "\n",
      );
    const before = (audit().match(/ARTIFACT_(CREATED|UPDATED)/g) ?? []).length;
    hook("audit-and-sensors", {
      hook_event_name: "PostToolUse",
      session_id: "main-1",
      prompt_id: "p4",
      tool_name: "write",
      tool_input: { file_path: relFromProject, content: "# Requirements\n" },
      tool_response: { success: true, output: "", error: null },
    });
    hook("audit-and-sensors", {
      hook_event_name: "PostToolUse",
      session_id: "main-1",
      prompt_id: "p4",
      tool_name: "apply_patch",
      tool_input: { patch: `*** Begin Patch\n*** Update File: ${relFromProject}\n+more\n*** End Patch` },
      tool_response: { success: true },
    });
    const after = (audit().match(/ARTIFACT_(CREATED|UPDATED)/g) ?? []).length;
    expect(after - before).toBe(2);
  });
});
