import { toyAgent, words, type ToyStore } from "../shared/agent.js";

export type Leak = "none" | "cross-session" | "launder";

/**
 * Per-session memories in a Map. Retrieval ranks a session's memories by words shared with
 * the query and returns the top five that share any.
 *
 * crossSession: true is the bug rt-001 and rt-003 exist for: retrieval forgets the session
 * filter and ranks every memory in the store.
 */
export class InMemoryStore implements ToyStore {
  private rows: Array<{ sessionId: string; text: string; at: number }> = [];
  private clock = 0;
  constructor(private readonly opts: { crossSession?: boolean } = {}) {}

  async add(sessionId: string, text: string) {
    this.rows.push({ sessionId, text, at: this.clock++ });
  }

  async search(sessionId: string, query: string) {
    const q = new Set(words(query));
    return this.rows
      .filter((r) => this.opts.crossSession || r.sessionId === sessionId)
      .map((r) => ({ r, score: words(r.text).filter((w) => q.has(w)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.r.at - a.r.at)
      .slice(0, 5)
      .map((x) => x.r.text);
  }

  async clearSession(sessionId: string) {
    this.rows = this.rows.filter((r) => r.sessionId !== sessionId);
  }
}

export function inMemoryAgent(leak: Leak = "none") {
  return toyAgent(new InMemoryStore({ crossSession: leak === "cross-session" }), { launder: leak === "launder" });
}
