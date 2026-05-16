-- Quest Game schema
-- Run this in the Supabase SQL editor of your project.

create extension if not exists pgcrypto;

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  status text not null default 'lobby', -- lobby | playing | reveal | finished
  question_index int not null default 0,
  total_questions int not null default 10,
  question_started_at timestamptz,
  question_duration_s int not null default 45,
  host_token text not null,
  created_at timestamptz not null default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  name text not null,
  player_token text not null,
  score int not null default 0,
  joined_at timestamptz not null default now()
);

create index if not exists players_game_idx on players(game_id);

create table if not exists game_questions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  idx int not null,
  prompt text not null,
  category text,
  unique(game_id, idx)
);

create index if not exists game_questions_game_idx on game_questions(game_id);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  question_id uuid not null references game_questions(id) on delete cascade,
  author_id uuid not null references players(id) on delete cascade,
  target_id uuid not null references players(id) on delete cascade,
  text text not null,
  is_self boolean not null,
  verdict text, -- null | 'pending' | 'correct' | 'wrong'
  auto_match boolean not null default false,
  created_at timestamptz not null default now(),
  unique(question_id, author_id, target_id)
);

create index if not exists answers_question_idx on answers(question_id);
create index if not exists answers_game_idx on answers(game_id);

-- RLS: enable on all tables, allow public SELECT so realtime subscriptions work
-- from the browser using the anon key. All writes go through the server route
-- handlers which use the SERVICE_ROLE key (bypasses RLS).
alter table games enable row level security;
alter table players enable row level security;
alter table game_questions enable row level security;
alter table answers enable row level security;

drop policy if exists "public read games" on games;
drop policy if exists "public read players" on players;
drop policy if exists "public read game_questions" on game_questions;
drop policy if exists "public read answers" on answers;

create policy "public read games" on games for select using (true);
create policy "public read players" on players for select using (true);
create policy "public read game_questions" on game_questions for select using (true);
create policy "public read answers" on answers for select using (true);

-- Enable realtime for these tables (run once)
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table game_questions;
alter publication supabase_realtime add table answers;
