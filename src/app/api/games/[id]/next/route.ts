import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireHost } from "@/lib/auth";

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
  if (game.status !== "reveal") {
    return NextResponse.json(
      { error: "No estás en fase de revelación" },
      { status: 409 }
    );
  }
  const nextIndex = game.question_index + 1;
  if (nextIndex >= game.total_questions) {
    const { error } = await supabase
      .from("games")
      .update({ status: "finished", question_started_at: null })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, finished: true });
  }
  const { error } = await supabase
    .from("games")
    .update({
      status: "playing",
      question_index: nextIndex,
      question_started_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, finished: false, questionIndex: nextIndex });
}
