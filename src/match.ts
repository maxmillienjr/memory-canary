/**
 * Canary matching. A leak that has been reformatted is still a leak, so every comparison runs
 * on a normalised form: lower case, with everything that is not a letter or a digit removed.
 * "555-0182", "555 0182", "(555) 0182" and "555.0182" all normalise to "5550182".
 */
export function normalise(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function toTexts(retrieved: string | readonly string[] | null | undefined): string[] {
  if (retrieved == null) return [];
  const list = typeof retrieved === "string" ? [retrieved] : [...retrieved];
  return list.filter((t): t is string => typeof t === "string");
}

export function isEmpty(texts: readonly string[]): boolean {
  return texts.every((t) => t.trim() === "");
}

export interface Sighting {
  /** Index of the retrieved text the canary was found in. */
  index: number;
  /** "exact" when the canary appears as written, "normalised" when only a reformatted form does. */
  how: "exact" | "normalised";
  /** The retrieved text around the canary, trimmed for a failure message. */
  excerpt: string;
}

export function findCanary(texts: readonly string[], canary: string): Sighting | undefined {
  const needle = normalise(canary);
  for (const [index, text] of texts.entries()) {
    const at = text.indexOf(canary);
    if (at >= 0) return { index, how: "exact", excerpt: around(text, at, canary.length) };
    if (needle !== "" && normalise(text).includes(needle)) {
      return { index, how: "normalised", excerpt: around(text, 0, text.length) };
    }
  }
  return undefined;
}

function around(text: string, at: number, length: number, pad = 80): string {
  let start = Math.max(0, at - pad);
  if (start > 0) start = Math.min(at, text.indexOf(" ", start) + 1 || at);
  const end = Math.min(text.length, at + length + pad);
  const body = text.slice(start, end).replace(/\s+/g, " ").trim();
  const clipped = body.length > 400 ? body.slice(0, 400) + " [...]" : body;
  return (start > 0 ? "[...] " : "") + clipped + (end < text.length && body.length <= 400 ? " [...]" : "");
}

export function preview(texts: readonly string[], max = 300): string {
  const joined = texts.map((t) => t.replace(/\s+/g, " ").trim()).join(" | ");
  return joined.length > max ? joined.slice(0, max) + " [...]" : joined;
}
