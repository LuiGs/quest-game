import { SupabaseClient } from "@supabase/supabase-js";

/** Verify the request's host token matches the game. Returns the game row or null. */
export async function requireHost(
  supabase: SupabaseClient,
  gameId: string,
  hostToken: string | null | undefined
) {
  if (!hostToken) return null;
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .maybeSingle();
  if (error || !data) return null;
  if (data.host_token !== hostToken) return null;
  return data;
}

/** Verify the request's player token matches a player in the game. */
export async function requirePlayer(
  supabase: SupabaseClient,
  gameId: string,
  playerId: string | null | undefined,
  playerToken: string | null | undefined
) {
  if (!playerId || !playerToken) return null;
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .eq("game_id", gameId)
    .maybeSingle();
  if (error || !data) return null;
  if (data.player_token !== playerToken) return null;
  return data;
}

/**
 * Check whether an admin token matches the server-side `ADMIN_TOKEN` env var.
 * Used to gate question-bank mutations. Returns false if the env var is unset
 * (i.e. admin features are effectively disabled).
 */
export function isAdmin(token: string | null | undefined): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  if (!token) return false;
  return token === expected;
}
