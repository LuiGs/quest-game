import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireHost } from "@/lib/auth";
import { recomputeScores } from "@/lib/judge";

/**
 * Body: { hostToken, playerId, delta: number }
 * Add `delta` (positive or negative) to the player's manual score bonus.
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    hostToken?: string;
    playerId?: string;
    delta?: number;
  };
  const delta = Math.round(body.delta ?? 0);
  if (!body.playerId || !Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ error: "Bad input" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const game = await requireHost(supabase, id, body.hostToken);
  if (!game) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("id, game_id, score_bonus")
    .eq("id", body.playerId)
    .maybeSingle();
  if (pErr || !player || player.game_id !== id) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  const { error } = await supabase
    .from("players")
    .update({ score_bonus: (player.score_bonus ?? 0) + delta })
    .eq("id", body.playerId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await recomputeScores(supabase, id);
  return NextResponse.json({ ok: true });
}
