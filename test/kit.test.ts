import assert from "node:assert/strict";
import { test } from "node:test";
import { inMemoryAgent } from "../examples/in-memory/store.js";
import {
  CanaryLeakError,
  defineCanaryTests,
  findCanary,
  normalise,
  runCanaryCases,
  type CaseResult,
  type MemoryAdapter,
} from "../src/index.js";

const byId = (results: CaseResult[]) => Object.fromEntries(results.map((r) => [r.id, r]));
const failedCheck = (r: CaseResult | undefined) => r?.checks.find((c) => !c.ok)?.name;

test("normalise and findCanary see through spaces, dashes, dots, brackets and case", () => {
  assert.equal(normalise("(555) 0182"), "5550182");
  for (const form of ["555-0182", "555 0182", "555.0182", "(555)0182", "5550182"]) {
    assert.ok(findCanary([`call ${form} today`], "555-0182"), form);
  }
  assert.equal(findCanary(["call 555-0183"], "555-0182"), undefined);
  assert.equal(findCanary(["Fax CLAIMS-DESK"], "claims desk")?.how, "normalised");
});

test("the safe store passes all three cases", async () => {
  const results = await runCanaryCases(inMemoryAgent("none"));
  assert.deepEqual(results.map((r) => r.status), ["pass", "pass", "pass"]);
});

test("a store that drops the session filter fails rt-001 and rt-003 with the canary quoted", async () => {
  const r = byId(await runCanaryCases(inMemoryAgent("cross-session")));
  assert.equal(r["planted-fact"]?.status, "fail");
  assert.match(r["planted-fact"]!.message, /LEAK: canary "555-0182" planted in session \S+-attacker appeared in session \S+-victim/);
  assert.equal(r["write-path"]?.status, "fail");
  assert.match(r["write-path"]!.message, /555-0119/);
  assert.equal(r["laundered-answer"]?.status, "pass");
});

test("an agent that writes its answers back to memory fails rt-002 only", async () => {
  const r = byId(await runCanaryCases(inMemoryAgent("launder")));
  assert.equal(r["laundered-answer"]?.status, "fail");
  assert.match(r["laundered-answer"]!.message, /555-0136/);
  assert.equal(r["planted-fact"]?.status, "pass");
  assert.equal(r["write-path"]?.status, "pass");
});

test("a reformatted leak is still a leak", async () => {
  const leaky = inMemoryAgent("cross-session");
  const adapter: MemoryAdapter = {
    ...leaky,
    retrieve: async (s, q) => ((await leaky.retrieve(s, q)) as string[]).map((t) => t.replace(/555-(\d{4})/g, "(555) $1")),
  };
  const r = byId(await runCanaryCases(adapter, { only: ["planted-fact"] }));
  assert.equal(r["planted-fact"]?.status, "fail");
  assert.match(r["planted-fact"]!.message, /after normalising/);
});

test("empty retrieval for the victim fails the non-empty check, not passes as isolated", async () => {
  const leaky = inMemoryAgent("cross-session");
  const adapter: MemoryAdapter = {
    ...leaky,
    retrieve: async (s, q) => (s.endsWith("-victim") ? [] : leaky.retrieve(s, q)),
  };
  const results = await runCanaryCases(adapter);
  for (const r of results) {
    assert.equal(r.status, "fail", r.id);
    if (r.id !== "laundered-answer") assert.equal(failedCheck(r), "victim-context-not-empty", r.id);
  }
});

test("a store that drops the canary fails the positive control", async () => {
  const safe = inMemoryAgent("none");
  const drop = (t: string) => /555-01\d\d/.test(t);
  const adapter: MemoryAdapter = {
    ...safe,
    write: async (s, t) => (drop(t) ? undefined : safe.write(s, t)),
    turn: async (s, m) => (drop(m) ? "noted" : safe.turn!(s, m)),
  };
  for (const r of await runCanaryCases(adapter)) {
    assert.equal(r.status, "fail", r.id);
    assert.equal(failedCheck(r), "positive-control", r.id);
  }
});

test("without turn() the write-path cases are skipped, never passed", async () => {
  const { turn: _turn, ...twoFunctions } = inMemoryAgent("none");
  const r = byId(await runCanaryCases(twoFunctions));
  assert.equal(r["planted-fact"]?.status, "pass");
  assert.equal(r["laundered-answer"]?.status, "skip");
  assert.equal(r["write-path"]?.status, "skip");
});

test("each case clears the sessions it used, and two runs never share a session id", async () => {
  const seen: string[] = [];
  const cleared: string[] = [];
  const safe = inMemoryAgent("none");
  const adapter: MemoryAdapter = {
    ...safe,
    write: async (s, t) => (seen.push(s), safe.write(s, t)),
    clearSession: async (s) => (cleared.push(s), safe.clearSession!(s)),
  };
  await runCanaryCases(adapter);
  const first = new Set(seen);
  assert.deepEqual(new Set(cleared), new Set([...first, ...cleared]));
  for (const s of first) assert.ok(cleared.includes(s), s);
  seen.length = 0;
  await runCanaryCases(adapter);
  for (const s of seen) assert.ok(!first.has(s), s);
});

test("defineCanaryTests registers one test per case, throws on a leak and skips what it cannot run", async () => {
  const registered: Array<{ name: string; fn: (ctx: { skip?: (m?: string) => void }) => Promise<void> }> = [];
  const fakeTest = (name: string, fn: (typeof registered)[number]["fn"]) => registered.push({ name, fn });

  defineCanaryTests(fakeTest, () => inMemoryAgent("cross-session"));
  assert.equal(registered.length, 3);
  await assert.rejects(registered[0]!.fn({}), (e: unknown) => e instanceof CanaryLeakError && /555-0182/.test(e.message));

  registered.length = 0;
  const { turn: _turn, ...twoFunctions } = inMemoryAgent("none");
  defineCanaryTests(fakeTest, twoFunctions);
  const skipped: string[] = [];
  for (const t of registered) await t.fn({ skip: (m) => skipped.push(m ?? "") });
  assert.equal(skipped.length, 2);
});
