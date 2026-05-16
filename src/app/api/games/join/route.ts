import { NextResponse, NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { createServiceClient } from "@/lib/supabase";

const MAX_PLAYERS = 8;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    code?: string;
  };
  const code = (body.code ?? "").trim();
  if (!code) {
    return NextResponse.json(
      { error: "Código requerido" },
      { status: 400 }
    );
  }
  const normalizedCode = code.toUpperCase();
  const name = (body.name ?? "").trim().slice(0, 24);
  if (!name) {
    return NextResponse.json(
      { error: "Nombre requerido" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data: game, error: gErr } = await supabase
    .from("games")
    .select("id, status")
    .eq("code", normalizedCode)
    .maybeSingle();
  if (gErr) {
    return NextResponse.json({ error: gErr.message }, { status: 500 });
  }
  if (!game) {
    return NextResponse.json(
      { error: "Código de partida no encontrado" },
      { status: 404 }
    );
  }
  if (game.status !== "lobby") {
    return NextResponse.json(
      { error: "La partida ya empezó" },
      { status: 409 }
    );
  }

  const { count: existingCount, error: cntErr } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true })
    .eq("game_id", game.id);
  if (cntErr) {
    return NextResponse.json({ error: cntErr.message }, { status: 500 });
  }
  if ((existingCount ?? 0) >= MAX_PLAYERS) {
    return NextResponse.json(
      { error: "La partida está llena" },
      { status: 409 }
    );
  }

  const playerToken = nanoid(32);
  const { data: player, error: pErr } = await supabase
    .from("players")
    .insert({
      game_id: game.id,
      name,
      player_token: playerToken,
    })
    .select("id")
    .single();
  if (pErr || !player) {
    return NextResponse.json(
      { error: pErr?.message ?? "No se pudo crear el jugador" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    gameId: game.id,
    playerId: player.id,
    playerToken,
  });
}
