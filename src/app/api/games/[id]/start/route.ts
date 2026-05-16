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
  if (game.status !== "lobby") {
    return NextResponse.json(
      { error: "La partida ya empezó" },
      { status: 409 }
    );
  }
  const { count } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true })
    .eq("game_id", id);
  if ((count ?? 0) < 2) {
    return NextResponse.json(
      { error: "Se necesitan al menos 2 jugadores" },
      { status: 400 }
    );
  }
  const { error } = await supabase
    .from("games")
    .update({
      status: "playing",
      question_index: 0,
      question_started_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
