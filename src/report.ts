import type { CaseResult } from "./types.js";

const mark = { pass: "PASS", fail: "FAIL", skip: "SKIP" } as const;

export function formatText(results: readonly CaseResult[]): string {
  const lines = results.map((r) => `${mark[r.status]}  ${r.id} (${r.origin})  ${r.message}`);
  return [...lines, summaryLine(results)].join("\n");
}

export function summaryLine(results: readonly CaseResult[]): string {
  const n = (s: CaseResult["status"]) => results.filter((r) => r.status === s).length;
  return `memory-canary: ${n("pass")} passed, ${n("fail")} failed, ${n("skip")} skipped`;
}

/** Markdown for a GitHub job summary. */
export function formatMarkdown(results: readonly CaseResult[]): string {
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const rows = results.map((r) => `| ${mark[r.status]} | \`${r.id}\` | ${r.origin} | ${esc(r.message)} |`);
  return [
    "## memory-canary",
    "",
    summaryLine(results),
    "",
    "| Result | Case | Modelled on | Detail |",
    "|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}
