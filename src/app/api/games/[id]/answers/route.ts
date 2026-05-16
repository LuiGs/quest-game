import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requirePlayer } from "@/lib/auth";

/**
 * Body: { playerId, playerToken, answers: [{ targetId, text, isSelf }] }
 * Upserts all answers for the current question of this game.
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    playerId?: string;
    playerToken?: string;
    answers?: { targetId: string; text: string; isSelf: boolean }[];
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

  const { data: game, error: gErr } = await supabase
    .from("games")
    .select("id, status, question_index")
    .eq("id", id)
    .maybeSingle();
  if (gErr || !game) {
    return NextResponse.json(
      { error: gErr?.message ?? "Game not found" },
      { status: 404 }
    );
  }
  if (game.status !== "playing") {
    return NextResponse.json(
      { error: "No hay pregunta activa" },
      { status: 409 }
    );
  }
  const { data: question } = await supabase
    .from("game_questions")
    .select("id")
    .eq("game_id", id)
    .eq("idx", game.question_index)
    .maybeSingle();
  if (!question) {
    return NextResponse.json(
      { error: "Pregunta no encontrada" },
      { status: 404 }
    );
  }

  const answers = (body.answers ?? [])
    .filter(
      (a) => a && typeof a.targetId === "string" && typeof a.text === "string"
    )
    .map((a) => ({
      game_id: id,
      question_id: question.id,
      author_id: player.id,
      target_id: a.targetId,
      text: a.text.trim().slice(0, 140),
      is_self: !!a.isSelf,
    }))
    // skip empty texts
    .filter((a) => a.text.length > 0);

  if (answers.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const { error } = await supabase
    .from("answers")
    .upsert(answers, { onConflict: "question_id,author_id,target_id" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: answers.length });
}
