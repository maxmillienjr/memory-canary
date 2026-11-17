// The module the CLI and the GitHub Action load: it exports the adapter as "adapter".
import { inMemoryAgent } from "./store.js";

export const adapter = inMemoryAgent("launder");
