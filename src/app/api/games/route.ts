import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createServiceClient } from "@/lib/supabase";
import { generateGameCode } from "@/lib/codes";
import { pickQuestions } from "@/lib/questions";

const DEFAULT_TOTAL_QUESTIONS = 10;
const DEFAULT_DURATION_S = 60;

export async function POST(request: Request) {
  let body: { totalQuestions?: number; durationSeconds?: number } = {};
  try {
    body = await request.json();
  } catch {
    /* allow empty body */
  }

  const total = clampInt(body.totalQuestions, 3, 40, DEFAULT_TOTAL_QUESTIONS);
  const duration = clampInt(body.durationSeconds, 15, 180, DEFAULT_DURATION_S);

  const supabase = createServiceClient();
  const hostToken = nanoid(32);

  // Try a few times in case of code collision (very unlikely with 5 chars).
  let game: { id: string; code: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateGameCode();
    const { data, error } = await supabase
      .from("games")
      .insert({
        code,
        host_token: hostToken,
        total_questions: total,
        question_duration_s: duration,
      })
      .select("id, code")
      .single();
    if (!error && data) {
      game = data;
      break;
    }
    if (error && error.code !== "23505") {
      // not a unique-violation: bail out
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
  }
  if (!game) {
    return NextResponse.json(
      { error: "Could not allocate a game code" },
      { status: 500 }
    );
  }

  // Pre-pick the question list for this game.
  const questions = pickQuestions(total).map((q, idx) => ({
    game_id: game!.id,
    idx,
    prompt: q.prompt,
    category: q.category,
  }));
  const { error: qErr } = await supabase
    .from("game_questions")
    .insert(questions);
  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  return NextResponse.json({
    gameId: game.id,
    code: game.code,
    hostToken,
  });
}

function clampInt(
  v: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
