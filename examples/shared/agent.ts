import type { MemoryAdapter } from "../../src/index.js";

/** The smallest store the toy agent needs. Both examples implement it. */
export interface ToyStore {
  add(sessionId: string, text: string): Promise<void>;
  search(sessionId: string, query: string): Promise<string[]>;
  clearSession(sessionId: string): Promise<void>;
  close?(): Promise<void>;
}

/**
 * A toy agent over a toy store. One turn: retrieve the session's context, answer by repeating
 * it (a real model would paraphrase; repeating is the worst case), then distill. Distill keeps
 * what the user stated (a message that is not a question) as a memory of that session.
 *
 * With launder: true, distill also keeps the agent's own answer, which is the bug rt-002 is
 * about: whatever the agent retrieved goes back into memory under new text.
 */
export function toyAgent(store: ToyStore, opts: { launder?: boolean } = {}): MemoryAdapter {
  return {
    write: (sessionId, text) => store.add(sessionId, text),
    retrieve: (sessionId, query) => store.search(sessionId, query),
    async turn(sessionId, message) {
      const context = await store.search(sessionId, message);
      const answer = context.length > 0 ? `From what I have on file: ${context.join(" ")}` : "I have nothing on file about that.";
      if (!message.trim().endsWith("?")) await store.add(sessionId, message);
      if (opts.launder) await store.add(sessionId, answer);
      return answer;
    },
    clearSession: (sessionId) => store.clearSession(sessionId),
    close: async () => store.close?.(),
  };
}

/** Lower-case words of four letters or more, the toy's idea of meaning. */
export function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [];
}
