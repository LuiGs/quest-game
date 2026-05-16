import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireHost } from "@/lib/auth";

/** Resume a paused question timer, accumulating paused ms. */
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
  if (!game.paused_started_at) {
    return NextResponse.json({ ok: true, notPaused: true });
  }
  const elapsedMs =
    Date.now() - new Date(game.paused_started_at).getTime();
  const { error } = await supabase
    .from("games")
    .update({
      paused_started_at: null,
      paused_ms_total: (game.paused_ms_total ?? 0) + Math.max(0, elapsedMs),
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
