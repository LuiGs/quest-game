import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireHost } from "@/lib/auth";
import { judgeQuestion } from "@/lib/judge";

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
  if (game.status !== "playing") {
    return NextResponse.json(
      { error: "No hay pregunta activa" },
      { status: 409 }
    );
  }

  const { data: question, error: qErr } = await supabase
    .from("game_questions")
    .select("id")
    .eq("game_id", id)
    .eq("idx", game.question_index)
    .maybeSingle();
  if (qErr || !question) {
    return NextResponse.json(
      { error: qErr?.message ?? "Pregunta no encontrada" },
      { status: 500 }
    );
  }

  const stats = await judgeQuestion(supabase, id, question.id);

  const { error } = await supabase
    .from("games")
    .update({ status: "reveal" })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, stats });
}
