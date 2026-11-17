/**
 * What the kit needs from your agent. Two functions are required; the rest are optional.
 *
 * - `write` stores one memory for one session, the way your agent's memory layer does.
 * - `retrieve` returns the context your agent would put in front of the model for that session
 *   and that query: the text, or the list of texts, after every filter and ranking step you run.
 *
 * Optional:
 * - `turn` runs one full agent turn for a session (retrieval, answer, and whatever your agent
 *   writes back to memory afterwards) and returns the answer text. Two of the three cases go
 *   through your agent's own write path and need it; without it they are reported as skipped.
 * - `clearSession` deletes everything stored for a session. When present, each case cleans up
 *   the sessions it used. Session ids are unique per run either way, so reruns do not collide.
 * - `close` is called once by the CLI after the run (close a pool, stop a client).
 */
export interface MemoryAdapter {
  write(sessionId: string, text: string): Promise<unknown>;
  retrieve(sessionId: string, query: string): Promise<string | readonly string[]>;
  turn?(sessionId: string, message: string): Promise<string | void>;
  clearSession?(sessionId: string): Promise<void>;
  close?(): Promise<void>;
}

export type CheckName =
  | "positive-control"
  | "victim-context-not-empty"
  | "canary-absent"
  | "canary-absent-from-answer";

export interface CheckResult {
  name: CheckName;
  ok: boolean;
  detail: string;
}

export interface CaseResult {
  id: string;
  title: string;
  /** The red-team case in the P4-B PRD this one is modelled on. */
  origin: string;
  status: "pass" | "fail" | "skip";
  /** The checks that ran, in order. A case stops at its first failing check. */
  checks: CheckResult[];
  /** One message for humans: the failing check, or why the case was skipped, or "passed". */
  message: string;
}

export interface RunOptions {
  /** Run only these case ids. Default: all three. */
  only?: readonly string[];
  /** Prefix for generated session ids. Default: "memory-canary". */
  sessionPrefix?: string;
}

export interface CanaryCase {
  id: string;
  title: string;
  origin: string;
  requiresTurn: boolean;
  run(adapter: MemoryAdapter, session: (role: string) => string): Promise<CheckResult[]>;
}
