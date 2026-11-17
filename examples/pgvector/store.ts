import { createHash } from "node:crypto";
import pg from "pg";
import { toyAgent, words, type ToyStore } from "../shared/agent.js";
import type { Leak } from "../in-memory/store.js";

export const DEFAULT_URL = "postgres://canary:canary@localhost:54329/canary";
const DIM = 64;

/**
 * A deterministic fake embedding, so the example needs no model and no network: each word is
 * hashed into one of 64 buckets and the vector is normalised. Texts that share words point the
 * same way, which is all the cases need.
 */
export function fakeEmbedding(text: string): number[] {
  const v = new Array<number>(DIM).fill(0);
  for (const w of words(text)) v[createHash("sha256").update(w).digest().readUInt32BE(0) % DIM]! += 1;
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

const literal = (v: number[]) => `[${v.join(",")}]`;

/**
 * Memories in one table with a session column. Retrieval is cosine distance, top five.
 * crossSession: true drops the `where session_id = $1`, the one-line bug the cases catch.
 */
export class PgVectorStore implements ToyStore {
  private ready: Promise<void>;
  constructor(
    private readonly pool: pg.Pool,
    private readonly opts: { crossSession?: boolean } = {},
  ) {
    this.ready = this.migrate();
  }

  /** Creates the extension, table and index once. The advisory lock lets several stores start together. */
  private async migrate() {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(7340551)");
      await client.query("create extension if not exists vector");
      await client.query(
        `create table if not exists canary_memories (
           id bigserial primary key,
           session_id text not null,
           content text not null,
           embedding vector(${DIM}) not null)`,
      );
      await client.query("create index if not exists canary_memories_session on canary_memories (session_id)");
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  }

  async add(sessionId: string, text: string) {
    await this.ready;
    await this.pool.query("insert into canary_memories (session_id, content, embedding) values ($1, $2, $3)", [
      sessionId,
      text,
      literal(fakeEmbedding(text)),
    ]);
  }

  async search(sessionId: string, query: string) {
    await this.ready;
    const q = literal(fakeEmbedding(query));
    const { rows } = this.opts.crossSession
      ? await this.pool.query("select content from canary_memories order by embedding <=> $1 limit 5", [q])
      : await this.pool.query(
          "select content from canary_memories where session_id = $1 order by embedding <=> $2 limit 5",
          [sessionId, q],
        );
    return rows.map((r: { content: string }) => r.content);
  }

  async clearSession(sessionId: string) {
    await this.ready;
    await this.pool.query("delete from canary_memories where session_id = $1", [sessionId]);
  }

  async close() {
    await this.pool.end();
  }
}

export function pgVectorAgent(leak: Leak = "none", url = process.env.MEMORY_CANARY_PG_URL ?? DEFAULT_URL) {
  const store = new PgVectorStore(new pg.Pool({ connectionString: url, max: 2 }), {
    crossSession: leak === "cross-session",
  });
  return toyAgent(store, { launder: leak === "launder" });
}
