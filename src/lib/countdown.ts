"use client";

import { useEffect, useState } from "react";
import type { Game } from "./types";

/**
 * Shared countdown for the active question. Respects pause state and any
 * extra seconds the host has granted. Used by both host and player views so
 * that pause/+30s actions made by the host are visible to everyone in
 * realtime via Supabase.
 */
export function useCountdown(game: Game | null | undefined): {
  remaining: number;
  paused: boolean;
  total: number;
} {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  if (!game)
    return { remaining: 0, paused: false, total: 0 };
  const total = game.question_duration_s + (game.question_extra_s ?? 0);
  if (!game.question_started_at)
    return { remaining: total, paused: false, total };
  const startMs = new Date(game.question_started_at).getTime();
  const paused = !!game.paused_started_at;
  const effectiveNow = paused
    ? new Date(game.paused_started_at as string).getTime()
    : now;
  const elapsedMs = effectiveNow - startMs - (game.paused_ms_total ?? 0);
  const remaining = Math.max(0, total - Math.floor(elapsedMs / 1000));
  return { remaining, paused, total };
}
