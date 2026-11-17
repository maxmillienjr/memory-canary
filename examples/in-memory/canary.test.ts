// The kit as one test per case, in node:test. Vitest is the same with `import { test } from "vitest"`.
//
//   npm run example:test          the safe store: three passing tests
//   npm run example:test:leaky    the same tests on a store that forgets the session filter
import { test } from "node:test";
import { defineCanaryTests } from "../../src/index.js";
import { inMemoryAgent, type Leak } from "./store.js";

const leak = (process.env.MEMORY_CANARY_LEAK ?? "none") as Leak;

defineCanaryTests(test, () => inMemoryAgent(leak));
