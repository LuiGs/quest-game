import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requirePlayer } from "@/lib/auth";
import { recomputeScores } from "@/lib/judge";

/**
 * Body: { playerId, playerToken, answerId, vote: 'correct'|'partial'|'wrong' }
 * The voter MUST be the `target_id` of the answer (you can only judge what
 * others said about you).
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    playerId?: string;
    playerToken?: string;
    answerId?: string;
    vote?: "correct" | "partial" | "wrong";
  };
  const supabase = createServiceClient();
  const player = await requirePlayer(
    supabase,
    id,
    body.playerId,
    body.playerToken
  );
  if (!player) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (
    !body.answerId ||
    (body.vote !== "correct" &&
      body.vote !== "partial" &&
      body.vote !== "wrong")
  ) {
    return NextResponse.json({ error: "Bad input" }, { status: 400 });
  }

  const { data: answer, error: aErr } = await supabase
    .from("answers")
    .select("id, game_id, target_id, is_self")
    .eq("id", body.answerId)
    .maybeSingle();
  if (aErr || !answer) {
    return NextResponse.json(
      { error: aErr?.message ?? "Answer not found" },
      { status: 404 }
    );
  }
  if (answer.game_id !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (answer.is_self) {
    return NextResponse.json(
      { error: "No se juzgan las auto-respuestas" },
      { status: 400 }
    );
  }
  if (answer.target_id !== player.id) {
    return NextResponse.json(
      { error: "Solo el sujeto de la pregunta puede votar" },
      { status: 403 }
    );
  }

  // peer_vote and verdict move together unless host has overridden later.
  const { error } = await supabase
    .from("answers")
    .update({ peer_vote: body.vote, verdict: body.vote })
    .eq("id", body.answerId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await recomputeScores(supabase, id);
  return NextResponse.json({ ok: true });
}
