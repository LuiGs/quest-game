export type GameStatus = "lobby" | "playing" | "reveal" | "finished";

export type Game = {
  id: string;
  code: string;
  status: GameStatus;
  question_index: number;
  total_questions: number;
  question_started_at: string | null;
  question_duration_s: number;
  question_extra_s: number;
  paused_started_at: string | null;
  paused_ms_total: number;
  host_token: string;
  created_at: string;
};

export type GameQuestion = {
  id: string;
  game_id: string;
  idx: number;
  prompt: string;
  category: string | null;
  skipped: boolean;
};

export type Player = {
  id: string;
  game_id: string;
  name: string;
  player_token: string;
  score: number;
  score_bonus: number;
  joined_at: string;
};

export type Verdict = "correct" | "partial" | "wrong" | "pending";
export type PeerVote = "correct" | "partial" | "wrong";

export type Answer = {
  id: string;
  game_id: string;
  question_id: string;
  author_id: string;
  target_id: string;
  text: string;
  is_self: boolean;
  verdict: Verdict | null;
  peer_vote: PeerVote | null;
  auto_match: boolean;
  created_at: string;
};

export type Question = {
  id: string;
  prompt: string;
  category: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type Prize = {
  id: string;
  game_id: string;
  recipient_id: string;
  label: string;
  given_at: string;
};
