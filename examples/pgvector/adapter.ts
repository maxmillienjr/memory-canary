// The module the CLI and the GitHub Action load. MEMORY_CANARY_LEAK picks the variant:
// unset or "none" (safe), "cross-session" or "launder".
import type { Leak } from "../in-memory/store.js";
import { pgVectorAgent } from "./store.js";

export async function createAdapter() {
  return pgVectorAgent((process.env.MEMORY_CANARY_LEAK ?? "none") as Leak);
}
