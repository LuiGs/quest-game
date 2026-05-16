import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireHost } from "@/lib/auth";
import { recomputeScores } from "@/lib/judge";

/**
 * Host overrides the verdict for one answer. Body:
 *   { hostToken, answerId, verdict: 'correct' | 'wrong' }
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    hostToken?: string;
    answerId?: string;
    verdict?: "correct" | "wrong";
  };
  const supabase = createServiceClient();
  const game = await requireHost(supabase, id, body.hostToken);
  if (!game) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (
    !body.answerId ||
    (body.verdict !== "correct" && body.verdict !== "wrong")
  ) {
    return NextResponse.json({ error: "Bad input" }, { status: 400 });
  }

  const { data: answer, error: aErr } = await supabase
    .from("answers")
    .select("id, game_id, is_self")
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
      { error: "Self answers no se juzgan" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("answers")
    .update({ verdict: body.verdict, auto_match: false })
    .eq("id", body.answerId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await recomputeScores(supabase, id);
  return NextResponse.json({ ok: true });
}
