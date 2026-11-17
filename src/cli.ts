#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { formatMarkdown, formatText } from "./report.js";
import { runCanaryCases } from "./run.js";
import type { MemoryAdapter } from "./types.js";

const usage = `usage: memory-canary <adapter-module> [--only case-id,case-id]

The module exports the adapter as its default export, as "adapter", or as an async factory
"createAdapter()". Exit code: 0 no leak, 1 a case failed, 2 the run could not start.`;

async function loadAdapter(path: string): Promise<MemoryAdapter> {
  const mod = await import(pathToFileURL(resolve(path)).href);
  const found = typeof mod.createAdapter === "function" ? await mod.createAdapter() : (mod.adapter ?? mod.default);
  if (!found || typeof found.write !== "function" || typeof found.retrieve !== "function") {
    throw new Error(`${path} does not export an adapter with write() and retrieve()`);
  }
  return found as MemoryAdapter;
}

async function main(argv: string[]): Promise<number> {
  const path = argv.find((a) => !a.startsWith("--"));
  const onlyAt = argv.indexOf("--only");
  if (!path || argv.includes("--help")) {
    console.error(usage);
    return 2;
  }
  const only = onlyAt >= 0 ? argv[onlyAt + 1]?.split(",").filter(Boolean) : undefined;
  let adapter: MemoryAdapter;
  try {
    adapter = await loadAdapter(path);
  } catch (err) {
    console.error(`memory-canary: could not load ${path}: ${(err as Error).message}`);
    return 2;
  }
  try {
    const results = await runCanaryCases(adapter, { only });
    console.log(formatText(results));
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) appendFileSync(summary, formatMarkdown(results));
    return results.some((r) => r.status === "fail") ? 1 : 0;
  } finally {
    await adapter.close?.();
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    console.error(`memory-canary: the adapter threw: ${(err as Error).stack ?? err}`);
    process.exit(2);
  },
);
