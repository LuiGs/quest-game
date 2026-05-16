import { SupabaseClient } from "@supabase/supabase-js";
import { autoVerdict } from "./normalize";

/** Points awarded per verdict. */
export const POINTS = { correct: 2, partial: 1, wrong: 0 } as const;

/**
 * Compute the initial (suggested) auto-verdict for every guess in a question.
 * Stores it in `auto_match`-style fields BUT leaves `verdict` as 'pending' so
 * the target player has to peer-vote to confirm. The auto verdict is only a
 * hint shown in the UI now — peer votes are the source of truth.
 *
 * Returns counts for analytics.
 */
export async function suggestVerdicts(
  supabase: SupabaseClient,
  gameId: string,
  questionId: string
): Promise<{ exact: number; close: number; far: number }> {
  const { data: answers, error } = await supabase
    .from("answers")
    .select("*")
    .eq("game_id", gameId)
    .eq("question_id", questionId);
  if (error || !answers) {
    throw new Error(error?.message ?? "Could not load answers");
  }

  const selfByTarget = new Map<string, string>();
  for (const a of answers) {
    if (a.is_self) selfByTarget.set(a.target_id, a.text);
  }

  let exact = 0;
  let close = 0;
  let far = 0;

  for (const a of answers) {
    if (a.is_self) continue;
    const truth = selfByTarget.get(a.target_id);
    let suggestion: "correct" | "partial" | "wrong";
    if (truth == null) {
      suggestion = "wrong";
    } else {
      const v = autoVerdict(a.text, truth);
      // map: pending → partial (the auto-judger thinks "maybe")
      suggestion = v === "pending" ? "partial" : v;
    }
    if (suggestion === "correct") exact += 1;
    else if (suggestion === "partial") close += 1;
    else far += 1;
    // store as the auto suggestion; verdict stays 'pending' awaiting peer vote
    await supabase
      .from("answers")
      .update({
        auto_match: suggestion === "correct",
        verdict: "pending",
      })
      .eq("id", a.id);
  }

  await recomputeScores(supabase, gameId);
  return { exact, close, far };
}

/** Recompute every player's stored score from current verdicts + bonus. */
export async function recomputeScores(
  supabase: SupabaseClient,
  gameId: string
) {
  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("id, score_bonus")
    .eq("game_id", gameId);
  if (pErr || !players) throw new Error(pErr?.message ?? "no players");

  const { data: judged, error: aErr } = await supabase
    .from("answers")
    .select("author_id, verdict")
    .eq("game_id", gameId)
    .eq("is_self", false)
    .in("verdict", ["correct", "partial"]);
  if (aErr) throw new Error(aErr.message);

  const tally = new Map<string, number>();
  for (const a of judged ?? []) {
    const pts =
      a.verdict === "correct"
        ? POINTS.correct
        : a.verdict === "partial"
        ? POINTS.partial
        : 0;
    tally.set(a.author_id, (tally.get(a.author_id) ?? 0) + pts);
  }

  for (const p of players) {
    const computed = tally.get(p.id) ?? 0;
    const bonus = p.score_bonus ?? 0;
    await supabase
      .from("players")
      .update({ score: computed + bonus })
      .eq("id", p.id);
  }
}
