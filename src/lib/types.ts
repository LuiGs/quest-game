export type GameStatus = "lobby" | "playing" | "reveal" | "finished";

export type Game = {
  id: string;
  code: string;
  status: GameStatus;
  question_index: number;
  total_questions: number;
  question_started_at: string | null;
  question_duration_s: number;
  host_token: string;
  created_at: string;
};

export type Player = {
  id: string;
  game_id: string;
  name: string;
  player_token: string;
  score: number;
  joined_at: string;
};

export type GameQuestion = {
  id: string;
  game_id: string;
  idx: number;
  prompt: string;
  category: string | null;
};

export type Verdict = "correct" | "wrong" | "pending";

export type Answer = {
  id: string;
  game_id: string;
  question_id: string;
  author_id: string;
  target_id: string;
  text: string;
  is_self: boolean;
  verdict: Verdict | null;
  auto_match: boolean;
  created_at: string;
};
