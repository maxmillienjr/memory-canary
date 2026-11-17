// Needs Postgres with pgvector: `npm run pgvector:up`, then `npm run example:pgvector`.
// Set MEMORY_CANARY_PG_URL to point somewhere else. The safe store passes; the leaky
// variants are run through runCanaryCases and must fail with the canary quoted.
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { defineCanaryTests, runCanaryCases } from "../../src/index.js";
import { pgVectorAgent } from "./store.js";

const safe = pgVectorAgent("none");
const leaky = pgVectorAgent("cross-session");
const launder = pgVectorAgent("launder");
after(async () => {
  for (const a of [safe, leaky, launder]) await a.close!();
});

defineCanaryTests(test, safe);

test("pgvector without the session filter leaks, and the kit says so", async () => {
  const r = await runCanaryCases(leaky);
  assert.deepEqual(r.map((x) => x.status), ["fail", "pass", "fail"]);
  assert.match(r[0]!.message, /LEAK: canary "555-0182"/);
});

test("pgvector with an agent that writes its answers back fails rt-002", async () => {
  const r = await runCanaryCases(launder);
  assert.deepEqual(r.map((x) => x.status), ["pass", "fail", "pass"]);
  assert.match(r[1]!.message, /555-0136/);
});
