import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireHost } from "@/lib/auth";

/**
 * Skip the current question: mark it as skipped, advance to the next one.
 * No judging happens. Existing answers stay (for archival) but no points.
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    hostToken?: string;
  };
  const supabase = createServiceClient();
  const game = await requireHost(supabase, id, body.hostToken);
  if (!game) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (game.status !== "playing" && game.status !== "reveal") {
    return NextResponse.json(
      { error: "Solo se puede saltar durante la partida" },
      { status: 409 }
    );
  }

  // Mark the current question as skipped.
  const { data: question } = await supabase
    .from("game_questions")
    .select("id")
    .eq("game_id", id)
    .eq("idx", game.question_index)
    .maybeSingle();
  if (question) {
    await supabase
      .from("game_questions")
      .update({ skipped: true })
      .eq("id", question.id);
    // Zero out any partial verdicts for this question
    await supabase
      .from("answers")
      .update({ verdict: "wrong", peer_vote: null })
      .eq("question_id", question.id)
      .eq("is_self", false);
  }

  const nextIndex = game.question_index + 1;
  if (nextIndex >= game.total_questions) {
    await supabase
      .from("games")
      .update({ status: "finished", question_started_at: null })
      .eq("id", id);
    return NextResponse.json({ ok: true, finished: true });
  }
  const { error } = await supabase
    .from("games")
    .update({
      status: "playing",
      question_index: nextIndex,
      question_started_at: new Date().toISOString(),
      question_extra_s: 0,
      paused_started_at: null,
      paused_ms_total: 0,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, finished: false });
}
