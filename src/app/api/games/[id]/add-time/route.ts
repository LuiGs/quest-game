import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireHost } from "@/lib/auth";

/** Add seconds to the current question's timer. Body: { hostToken, seconds }. */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    hostToken?: string;
    seconds?: number;
  };
  const seconds = Math.max(1, Math.min(300, Math.round(body.seconds ?? 30)));
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
  const { error } = await supabase
    .from("games")
    .update({ question_extra_s: (game.question_extra_s ?? 0) + seconds })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
