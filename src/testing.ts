import { runCase, newRunId, selectCases } from "./run.js";
import type { MemoryAdapter, RunOptions } from "./types.js";

/** The test context both node:test and Vitest pass to a test function; only skip() is used. */
interface SkippableContext {
  skip?: (message?: string) => void;
}

/** `test` from node:test, or `test` / `it` from Vitest. Anything with that call shape works. */
export type TestFn = (name: string, fn: (ctx: SkippableContext) => Promise<void>) => unknown;

/**
 * Registers one test per case with your runner. A leak fails the test with the canary quoted;
 * a case your adapter cannot run (no turn()) is marked skipped, never passed.
 *
 *   import { test } from "node:test";          // or: import { test } from "vitest";
 *   defineCanaryTests(test, () => createMyAdapter());
 */
export function defineCanaryTests(
  test: TestFn,
  adapter: MemoryAdapter | (() => MemoryAdapter | Promise<MemoryAdapter>),
  options: RunOptions = {},
): void {
  const runId = newRunId();
  for (const c of selectCases(options)) {
    test(`memory-canary ${c.id} (${c.origin}): ${c.title}`, async (ctx) => {
      const a = typeof adapter === "function" ? await adapter() : adapter;
      const result = await runCase(a, c, { ...options, runId });
      if (result.status === "skip") {
        if (typeof ctx?.skip === "function") ctx.skip(result.message);
        return;
      }
      if (result.status === "fail") throw new CanaryLeakError(result.message);
    });
  }
}

export class CanaryLeakError extends Error {
  override name = "CanaryLeakError";
}
