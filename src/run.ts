import { randomBytes } from "node:crypto";
import { cases as allCases } from "./cases.js";
import type { CanaryCase, CaseResult, MemoryAdapter, RunOptions } from "./types.js";

/** A run id unique to this process and this moment, so reruns never share a session. */
export function newRunId(): string {
  return `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}

export function selectCases(options: RunOptions = {}): CanaryCase[] {
  const only = options.only;
  if (!only) return [...allCases];
  const unknown = only.filter((id) => !allCases.some((c) => c.id === id));
  if (unknown.length > 0) throw new Error(`Unknown case id(s): ${unknown.join(", ")}`);
  return allCases.filter((c) => only.includes(c.id));
}

/** Runs one case against an adapter. Never throws for a leak; throws only if the adapter throws. */
export async function runCase(
  adapter: MemoryAdapter,
  c: CanaryCase,
  options: RunOptions & { runId?: string } = {},
): Promise<CaseResult> {
  const base = { id: c.id, title: c.title, origin: c.origin };
  if (c.requiresTurn && typeof adapter.turn !== "function") {
    return {
      ...base,
      status: "skip",
      checks: [],
      message: `Skipped: this case goes through the agent's own write path and needs the adapter's optional turn() function.`,
    };
  }
  const runId = options.runId ?? newRunId();
  const prefix = options.sessionPrefix ?? "memory-canary";
  const used = new Set<string>();
  const session = (role: string) => {
    const id = `${prefix}-${runId}-${c.id}-${role}`;
    used.add(id);
    return id;
  };
  try {
    const checks = await c.run(adapter, session);
    const failed = checks.find((r) => !r.ok);
    return {
      ...base,
      status: failed ? "fail" : "pass",
      checks,
      message: failed ? failed.detail : `Passed: ${checks.map((r) => r.name).join(", ")}.`,
    };
  } finally {
    if (typeof adapter.clearSession === "function") {
      for (const id of used) await adapter.clearSession(id);
    }
  }
}

/** Runs the cases (all three unless options.only says otherwise) and returns a result per case. */
export async function runCanaryCases(adapter: MemoryAdapter, options: RunOptions = {}): Promise<CaseResult[]> {
  const runId = newRunId();
  const results: CaseResult[] = [];
  for (const c of selectCases(options)) results.push(await runCase(adapter, c, { ...options, runId }));
  return results;
}
