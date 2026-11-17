export type { MemoryAdapter, CaseResult, CheckResult, CheckName, RunOptions, CanaryCase } from "./types.js";
export { cases, PAYER } from "./cases.js";
export { runCanaryCases, runCase, newRunId } from "./run.js";
export { defineCanaryTests, CanaryLeakError, type TestFn } from "./testing.js";
export { normalise, findCanary } from "./match.js";
export { formatText, formatMarkdown } from "./report.js";
