import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Pick N random non-archived questions from the global bank. Returns an array
 * of { prompt, category } suitable for inserting into game_questions.
 */
export async function pickQuestionsFromBank(
  supabase: SupabaseClient,
  n: number
): Promise<{ prompt: string; category: string | null }[]> {
  const { data, error } = await supabase
    .from("questions")
    .select("prompt, category")
    .eq("archived", false);
  if (error) throw new Error(error.message);
  const pool = [...(data ?? [])];
  if (pool.length === 0) return [];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}
