/**
 * Normalize a free-text answer for fuzzy comparison:
 * lowercase, strip diacritics, collapse whitespace, drop punctuation.
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance between two strings. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/** Similarity in [0,1] based on Levenshtein. */
export function similarity(a: string, b: string): number {
  const A = normalize(a);
  const B = normalize(b);
  if (!A && !B) return 1;
  const maxLen = Math.max(A.length, B.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(A, B) / maxLen;
}

/**
 * Compare a guess (answer about another player) to that player's self-answer.
 * Returns 'correct' | 'wrong' | 'pending':
 * - exact normalized match → correct
 * - similarity ≥ 0.85 → correct
 * - similarity ≥ 0.55 → pending (host should review)
 * - otherwise → wrong
 */
export function autoVerdict(
  guess: string,
  truth: string
): "correct" | "wrong" | "pending" {
  const g = normalize(guess);
  const t = normalize(truth);
  if (!g || !t) return "wrong";
  if (g === t) return "correct";
  // token-set match: every token of one appears in the other
  const gTokens = new Set(g.split(" "));
  const tTokens = new Set(t.split(" "));
  const overlap = [...gTokens].filter((x) => tTokens.has(x)).length;
  const tokenScore =
    overlap / Math.max(gTokens.size, tTokens.size);
  const sim = similarity(guess, truth);
  const best = Math.max(sim, tokenScore);
  if (best >= 0.85) return "correct";
  if (best >= 0.55) return "pending";
  return "wrong";
}
