"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "./supabase";
import type { Answer, Game, GameQuestion, Player } from "./types";

export type GameState = {
  game: Game | null;
  players: Player[];
  questions: GameQuestion[];
  answers: Answer[];
  loading: boolean;
};

/**
 * Subscribe to a single game and all its child rows in realtime. Pulls an
 * initial snapshot on mount and then keeps state in sync via Supabase
 * postgres_changes.
 */
export function useGameState(gameId: string | null): GameState {
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(
    null
  );

  useEffect(() => {
    if (!gameId) return;
    if (!supabaseRef.current) supabaseRef.current = createBrowserClient();
    const supabase = supabaseRef.current;
    let cancelled = false;

    async function snapshot() {
      const [g, p, q, a] = await Promise.all([
        supabase.from("games").select("*").eq("id", gameId).maybeSingle(),
        supabase
          .from("players")
          .select("*")
          .eq("game_id", gameId)
          .order("joined_at", { ascending: true }),
        supabase
          .from("game_questions")
          .select("*")
          .eq("game_id", gameId)
          .order("idx", { ascending: true }),
        supabase.from("answers").select("*").eq("game_id", gameId),
      ]);
      if (cancelled) return;
      setGame((g.data as Game) ?? null);
      setPlayers((p.data as Player[]) ?? []);
      setQuestions((q.data as GameQuestion[]) ?? []);
      setAnswers((a.data as Answer[]) ?? []);
      setLoading(false);
    }
    snapshot();

    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => {
          if (payload.eventType === "DELETE") setGame(null);
          else setGame(payload.new as Game);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` },
        (payload) => {
          setPlayers((prev) => applyChange(prev, payload));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_questions", filter: `game_id=eq.${gameId}` },
        (payload) => {
          setQuestions((prev) =>
            applyChange(prev, payload).sort((a, b) => a.idx - b.idx)
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "answers", filter: `game_id=eq.${gameId}` },
        (payload) => {
          setAnswers((prev) => applyChange(prev, payload));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  return { game, players, questions, answers, loading };
}

type Row = { id: string };
function applyChange<T extends Row>(
  prev: T[],
  payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    new: Record<string, unknown>;
    old: Record<string, unknown>;
  }
): T[] {
  if (payload.eventType === "DELETE") {
    const oldId = payload.old?.id as string | undefined;
    return oldId ? prev.filter((r) => r.id !== oldId) : prev;
  }
  const next = payload.new as unknown as T;
  const idx = prev.findIndex((r) => r.id === next.id);
  if (idx === -1) return [...prev, next];
  const copy = [...prev];
  copy[idx] = next;
  return copy;
}
