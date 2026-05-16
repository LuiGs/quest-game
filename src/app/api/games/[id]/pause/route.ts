import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireHost } from "@/lib/auth";

/** Pause the current question timer. */
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
  if (game.paused_started_at) {
    return NextResponse.json({ ok: true, alreadyPaused: true });
  }
  const { error } = await supabase
    .from("games")
    .update({ paused_started_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
