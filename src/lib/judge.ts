import { SupabaseClient } from "@supabase/supabase-js";
import { autoVerdict } from "./normalize";

/**
 * For a given game + question, judge all guesses (non-self answers) against the
 * matching self-answer of the target. Updates `verdict` and `auto_match`.
 * Returns the number of correct, wrong, and pending guesses.
 */
export async function judgeQuestion(
  supabase: SupabaseClient,
  gameId: string,
  questionId: string
): Promise<{ correct: number; wrong: number; pending: number }> {
  const { data: answers, error } = await supabase
    .from("answers")
    .select("*")
    .eq("game_id", gameId)
    .eq("question_id", questionId);
  if (error || !answers) {
    throw new Error(error?.message ?? "Could not load answers");
  }

  // Build a map: target_id -> self answer text
  const selfByTarget = new Map<string, string>();
  for (const a of answers) {
    if (a.is_self) selfByTarget.set(a.target_id, a.text);
  }

  const updates: { id: string; verdict: string; auto_match: boolean }[] = [];
  let correct = 0;
  let wrong = 0;
  let pending = 0;

  for (const a of answers) {
    if (a.is_self) continue;
    const truth = selfByTarget.get(a.target_id);
    if (truth == null) {
      // The target never submitted their self-answer in time → can't judge
      // automatically. Mark pending so the host can decide.
      updates.push({ id: a.id, verdict: "pending", auto_match: false });
      pending += 1;
      continue;
    }
    const v = autoVerdict(a.text, truth);
    updates.push({
      id: a.id,
      verdict: v,
      auto_match: v === "correct",
    });
    if (v === "correct") correct += 1;
    else if (v === "wrong") wrong += 1;
    else pending += 1;
  }

  // Persist verdicts
  for (const u of updates) {
    const { error: uErr } = await supabase
      .from("answers")
      .update({ verdict: u.verdict, auto_match: u.auto_match })
      .eq("id", u.id);
    if (uErr) throw new Error(uErr.message);
  }

  // Update player scores: +1 for each 'correct' guess they made
  await recomputeScores(supabase, gameId);

  return { correct, wrong, pending };
}

/** Recompute every player's score from scratch based on `correct` answers. */
export async function recomputeScores(
  supabase: SupabaseClient,
  gameId: string
) {
  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("id")
    .eq("game_id", gameId);
  if (pErr || !players) throw new Error(pErr?.message ?? "no players");

  const { data: correctAnswers, error: aErr } = await supabase
    .from("answers")
    .select("author_id")
    .eq("game_id", gameId)
    .eq("is_self", false)
    .eq("verdict", "correct");
  if (aErr) throw new Error(aErr.message);

  const tally = new Map<string, number>();
  for (const a of correctAnswers ?? []) {
    tally.set(a.author_id, (tally.get(a.author_id) ?? 0) + 1);
  }

  for (const p of players) {
    const score = tally.get(p.id) ?? 0;
    await supabase.from("players").update({ score }).eq("id", p.id);
  }
}
