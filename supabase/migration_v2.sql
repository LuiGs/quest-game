-- Quest Game — Migration v2
-- Safe to run multiple times. Adds:
--  - Global `questions` bank (editable from UI)
--  - Per-answer peer_vote (target judges guesses about them)
--  - Score bonus / manual adjust
--  - Pause + extra-seconds for current question
--  - Skipped questions
--  - Prizes timeline

-- 1. Global question bank ----------------------------------------------------
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  category text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists questions_archived_idx on questions(archived);

-- 2. Per-answer peer vote ----------------------------------------------------
alter table answers
  add column if not exists peer_vote text;  -- 'correct' | 'partial' | 'wrong' | null
-- verdict can now also be 'partial' (besides 'correct'|'wrong'|'pending'|null)

-- 3. Per-player manual bonus -------------------------------------------------
alter table players
  add column if not exists score_bonus int not null default 0;

-- 4. Per-question pause / extension on games --------------------------------
alter table games
  add column if not exists question_extra_s int not null default 0;
alter table games
  add column if not exists paused_started_at timestamptz;
alter table games
  add column if not exists paused_ms_total bigint not null default 0;

-- 5. Skipped flag on game_questions -----------------------------------------
alter table game_questions
  add column if not exists skipped boolean not null default false;

-- 6. Prizes timeline ---------------------------------------------------------
create table if not exists prizes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  recipient_id uuid not null references players(id) on delete cascade,
  label text not null,
  given_at timestamptz not null default now()
);
create index if not exists prizes_game_idx on prizes(game_id);

-- 7. RLS + Realtime for new tables ------------------------------------------
alter table questions enable row level security;
alter table prizes enable row level security;

drop policy if exists "public read questions" on questions;
drop policy if exists "public read prizes" on prizes;

create policy "public read questions" on questions for select using (true);
create policy "public read prizes" on prizes for select using (true);

-- Add new tables to realtime publication (idempotent: ignore error if already present).
do $$
begin
  alter publication supabase_realtime add table questions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table prizes;
exception when duplicate_object then null;
end $$;

-- 8. Seed the question bank from the original static list -------------------
insert into questions (prompt, category)
select v.prompt, v.category from (values
  ('Comida favorita', 'gustos'),
  ('Color favorito', 'gustos'),
  ('Película favorita', 'gustos'),
  ('Serie favorita', 'gustos'),
  ('Canción favorita', 'gustos'),
  ('Artista o banda favorita', 'gustos'),
  ('Bebida favorita', 'gustos'),
  ('Postre favorito', 'gustos'),
  ('Animal favorito', 'gustos'),
  ('Deporte favorito', 'gustos'),
  ('Videojuego favorito', 'gustos'),
  ('Libro favorito', 'gustos'),
  ('Hobby principal', 'vida'),
  ('Materia que más le gustaba en la escuela', 'vida'),
  ('Materia que menos le gustaba en la escuela', 'vida'),
  ('Mayor miedo', 'personalidad'),
  ('Mayor manía', 'personalidad'),
  ('Mayor virtud según él/ella', 'personalidad'),
  ('Lugar favorito del mundo', 'vida'),
  ('Ciudad donde le gustaría vivir', 'vida'),
  ('País que más quiere visitar', 'vida'),
  ('Mejor amigo/a actual', 'vida'),
  ('Primer trabajo o changa', 'vida'),
  ('Sueño que querría cumplir antes de los 40', 'vida'),
  ('Comida que odia', 'gustos'),
  ('Olor favorito', 'gustos'),
  ('Estación del año favorita', 'gustos'),
  ('Personaje de ficción favorito', 'gustos'),
  ('Red social que más usa', 'vida'),
  ('App que más abre en el celular', 'vida'),
  ('Hora a la que se levanta normalmente', 'vida'),
  ('Cosa que siempre lleva en el bolsillo', 'vida'),
  ('Mascota soñada', 'gustos'),
  ('Plato que mejor le sale cocinar', 'vida'),
  ('Cantante para cantar a los gritos en el auto', 'gustos'),
  ('Su frase o muletilla favorita', 'personalidad'),
  ('Mejor recuerdo de la infancia', 'vida'),
  ('Apodo de la infancia', 'vida'),
  ('Le da más vergüenza: bailar o cantar en público', 'personalidad'),
  ('Prefiere: playa o montaña', 'gustos')
) as v(prompt, category)
where not exists (select 1 from questions q where q.prompt = v.prompt);
