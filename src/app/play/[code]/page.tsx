"use client";

import {
  useEffect,
  useMemo,
  useState,
  use,
  useSyncExternalStore,
} from "react";
import { useGameState } from "@/lib/useGameState";
import type { Answer, GameQuestion, Player } from "@/lib/types";
import { createBrowserClient } from "@/lib/supabase";

type Session = { gameId: string; playerId: string; playerToken: string };

function subscribeToStorage(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function usePlayerSession(code: string): Session | null {
  const key = `player:${code}`;
  const raw = useSyncExternalStore(
    subscribeToStorage,
    () => (typeof window === "undefined" ? null : localStorage.getItem(key)),
    () => null
  );
  return useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  }, [raw]);
}

export default function PlayGamePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();
  const session = usePlayerSession(code);
  const [resolvedGameId, setResolvedGameId] = useState<string | null>(
    session?.gameId ?? null
  );

  // If we don't have a stored session, look up the game by code (read-only).
  useEffect(() => {
    if (resolvedGameId) return;
    let cancelled = false;
    (async () => {
      const supabase = createBrowserClient();
      const { data } = await supabase
        .from("games")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (!cancelled && data) setResolvedGameId(data.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [code, resolvedGameId]);

  if (!resolvedGameId) {
    return <NotFound code={code} />;
  }
  return <ConnectedGame gameId={resolvedGameId} code={code} session={session} />;
}

function NotFound({ code }: { code: string }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-linear-to-br from-indigo-950 via-purple-950 to-fuchsia-900 text-white">
      <p className="text-2xl">Buscando partida {code}…</p>
      <p className="text-purple-100/60 text-sm mt-2">
        Si no aparece en unos segundos, revisá el código.
      </p>
    </main>
  );
}

function ConnectedGame({
  gameId,
  code,
  session,
}: {
  gameId: string;
  code: string;
  session: Session | null;
}) {
  const { game, players, questions, answers, loading } = useGameState(gameId);
  const me = session
    ? players.find((p) => p.id === session.playerId) ?? null
    : null;

  if (loading || !game) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        Cargando…
      </main>
    );
  }

  // No session yet: show join form.
  if (!session || !me) {
    return <JoinForm code={code} game={game} />;
  }

  return (
    <main className="min-h-screen bg-linear-to-br from-indigo-950 via-purple-950 to-fuchsia-900 text-white p-5 sm:p-8">
      {game.status === "lobby" && <PlayerLobby players={players} me={me} />}
      {game.status === "playing" && (
        <PlayerPlaying
          gameId={gameId}
          session={session}
          me={me}
          players={players}
          question={questions.find((q) => q.idx === game.question_index)}
          questionIndex={game.question_index}
          totalQuestions={game.total_questions}
          questionStartedAt={game.question_started_at}
          duration={game.question_duration_s}
          answers={answers}
        />
      )}
      {game.status === "reveal" && (
        <PlayerReveal
          me={me}
          players={players}
          question={questions.find((q) => q.idx === game.question_index)}
          answers={answers}
        />
      )}
      {game.status === "finished" && (
        <PlayerFinished players={players} me={me} />
      )}
    </main>
  );
}

function JoinForm({
  code,
  game,
}: {
  code: string;
  game: { id: string; status: string };
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      const session: Session = {
        gameId: data.gameId,
        playerId: data.playerId,
        playerToken: data.playerToken,
      };
      localStorage.setItem(`player:${code}`, JSON.stringify(session));
      // Trigger storage subscribers in this tab.
      window.dispatchEvent(new StorageEvent("storage"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-linear-to-br from-indigo-950 via-purple-950 to-fuchsia-900 text-white">
      <div className="w-full max-w-md bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-8 space-y-6">
        <div>
          <p className="text-sm text-purple-200/70">Partida</p>
          <p className="text-3xl font-black tracking-widest">{code}</p>
        </div>
        {game.status !== "lobby" ? (
          <p className="text-amber-200">
            Esta partida ya empezó, no podés unirte.
          </p>
        ) : (
          <>
            <label className="block">
              <span className="text-sm text-purple-100/80">Tu nombre</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-fuchsia-400"
              />
            </label>
            {error && (
              <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
            <button
              onClick={join}
              disabled={busy || !name.trim()}
              className="w-full px-6 py-3 rounded-2xl bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-40 transition font-semibold"
            >
              {busy ? "Entrando…" : "Entrar"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

function PlayerLobby({ players, me }: { players: Player[]; me: Player }) {
  return (
    <div className="max-w-md mx-auto text-center space-y-6 pt-12">
      <p className="text-purple-200/70">Esperando que empiece la partida…</p>
      <p className="text-3xl font-bold">Hola, {me.name} 👋</p>
      <ul className="space-y-2">
        {players.map((p) => (
          <li
            key={p.id}
            className={`px-4 py-3 rounded-xl border ${
              p.id === me.id
                ? "bg-fuchsia-500/20 border-fuchsia-400/40"
                : "bg-black/30 border-white/10"
            }`}
          >
            {p.name} {p.id === me.id && "(vos)"}
          </li>
        ))}
      </ul>
    </div>
  );
}

function useCountdown(startedAt: string | null, durationSeconds: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  if (!startedAt) return durationSeconds;
  const elapsed = now - new Date(startedAt).getTime();
  return Math.max(0, durationSeconds - Math.floor(elapsed / 1000));
}

function PlayerPlaying({
  gameId,
  session,
  me,
  players,
  question,
  questionIndex,
  totalQuestions,
  questionStartedAt,
  duration,
  answers,
}: {
  gameId: string;
  session: Session;
  me: Player;
  players: Player[];
  question: GameQuestion | undefined;
  questionIndex: number;
  totalQuestions: number;
  questionStartedAt: string | null;
  duration: number;
  answers: Answer[];
}) {
  const remaining = useCountdown(questionStartedAt, duration);

  if (!question) {
    return (
      <div className="text-center pt-12 text-purple-100/70">Cargando…</div>
    );
  }

  // Re-mount the form whenever the question changes so its initial state is
  // freshly derived from existing answers without setState-in-effect.
  return (
    <QuestionForm
      key={question.id}
      gameId={gameId}
      session={session}
      me={me}
      players={players}
      question={question}
      questionIndex={questionIndex}
      totalQuestions={totalQuestions}
      remaining={remaining}
      answers={answers}
    />
  );
}

function QuestionForm({
  gameId,
  session,
  me,
  players,
  question,
  questionIndex,
  totalQuestions,
  remaining,
  answers,
}: {
  gameId: string;
  session: Session;
  me: Player;
  players: Player[];
  question: GameQuestion;
  questionIndex: number;
  totalQuestions: number;
  remaining: number;
  answers: Answer[];
}) {
  const initialDrafts = useMemo(() => {
    const init: Record<string, string> = {};
    for (const p of players) init[p.id] = "";
    for (const a of answers) {
      if (a.question_id !== question.id) continue;
      if (a.author_id !== me.id) continue;
      init[a.target_id] = a.text;
    }
    return init;
    // initial value only — we intentionally don't react to answers updates here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const initiallySubmitted = useMemo(() => {
    const mine = answers.filter(
      (a) => a.question_id === question.id && a.author_id === me.id
    );
    return mine.length >= players.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [drafts, setDrafts] = useState<Record<string, string>>(initialDrafts);
  const [submitted, setSubmitted] = useState(initiallySubmitted);
  const [error, setError] = useState<string | null>(null);

  const others = players.filter((p) => p.id !== me.id);

  async function submit() {
    if (!question) return;
    setError(null);
    const payload = players.map((p) => ({
      targetId: p.id,
      text: drafts[p.id] ?? "",
      isSelf: p.id === me.id,
    }));
    const res = await fetch(`/api/games/${gameId}/answers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: session.playerId,
        playerToken: session.playerToken,
        answers: payload,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Error");
      return;
    }
    setSubmitted(true);
  }

  const canSubmit =
    !!drafts[me.id]?.trim() &&
    others.every((p) => (drafts[p.id] ?? "").trim().length > 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <div className="flex justify-between items-center text-purple-100/70 text-xs uppercase tracking-widest">
        <span>
          {questionIndex + 1} / {totalQuestions}
        </span>
        <span
          className={
            remaining <= 5
              ? "text-red-300 text-lg font-bold"
              : "text-lg font-bold"
          }
        >
          {remaining}s
        </span>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-black">
          {question?.prompt ?? "…"}
        </h2>
      </div>

      <div className="space-y-4">
        <Field
          label={`Tu respuesta sobre VOS (${me.name})`}
          highlight
          value={drafts[me.id] ?? ""}
          onChange={(v) => setDrafts((d) => ({ ...d, [me.id]: v }))}
          disabled={submitted}
        />
        {others.map((p) => (
          <Field
            key={p.id}
            label={`Tu respuesta sobre ${p.name}`}
            value={drafts[p.id] ?? ""}
            onChange={(v) => setDrafts((d) => ({ ...d, [p.id]: v }))}
            disabled={submitted}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={!canSubmit || submitted}
        className="w-full px-6 py-4 rounded-2xl bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-40 transition font-semibold text-lg"
      >
        {submitted ? "✓ Enviado — esperando al resto" : "Enviar respuestas"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  highlight,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  return (
    <label className="block">
      <span
        className={`text-sm ${
          highlight ? "text-fuchsia-200" : "text-purple-100/80"
        }`}
      >
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={140}
        className={`w-full mt-1 px-3 py-3 rounded-xl border outline-none disabled:opacity-60 ${
          highlight
            ? "bg-fuchsia-500/10 border-fuchsia-400/40 focus:border-fuchsia-300"
            : "bg-black/30 border-white/10 focus:border-fuchsia-400"
        }`}
      />
    </label>
  );
}

function PlayerReveal({
  me,
  players,
  question,
  answers,
}: {
  me: Player;
  players: Player[];
  question: GameQuestion | undefined;
  answers: Answer[];
}) {
  const playerById = new Map(players.map((p) => [p.id, p]));
  const qa = answers.filter((a) => question && a.question_id === question.id);
  const selfByTarget = new Map<string, Answer>();
  for (const a of qa) if (a.is_self) selfByTarget.set(a.target_id, a);

  const myGuesses = qa.filter((a) => a.author_id === me.id && !a.is_self);
  const aboutMe = qa.filter((a) => a.target_id === me.id && !a.is_self);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center">
        <p className="text-xs uppercase tracking-widest text-purple-100/70 mb-2">
          Resultado
        </p>
        <h2 className="text-2xl sm:text-3xl font-black">{question?.prompt}</h2>
      </div>

      <section className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
        <h3 className="font-bold">Tus aciertos</h3>
        {myGuesses.length === 0 && (
          <p className="text-purple-100/60 text-sm">No respondiste sobre nadie.</p>
        )}
        {myGuesses.map((g) => {
          const target = playerById.get(g.target_id);
          const truth = selfByTarget.get(g.target_id);
          return (
            <div
              key={g.id}
              className="flex justify-between items-center text-sm bg-black/20 rounded-lg px-3 py-2"
            >
              <span>
                <span className="text-purple-100/70">{target?.name}:</span>{" "}
                {g.text}{" "}
                <span className="text-purple-100/40">
                  (real: {truth?.text ?? "—"})
                </span>
              </span>
              <Verdict v={g.verdict} />
            </div>
          );
        })}
      </section>

      <section className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
        <h3 className="font-bold">Lo que dijeron sobre vos</h3>
        {aboutMe.length === 0 && (
          <p className="text-purple-100/60 text-sm">Nadie respondió sobre vos.</p>
        )}
        {aboutMe.map((g) => {
          const author = playerById.get(g.author_id);
          return (
            <div
              key={g.id}
              className="flex justify-between items-center text-sm bg-black/20 rounded-lg px-3 py-2"
            >
              <span>
                <span className="text-purple-100/70">{author?.name}:</span>{" "}
                {g.text}
              </span>
              <Verdict v={g.verdict} />
            </div>
          );
        })}
      </section>

      <Standings players={players} me={me} />
    </div>
  );
}

function Verdict({ v }: { v: string | null }) {
  if (v === "correct")
    return <span className="text-emerald-300 font-bold">✓</span>;
  if (v === "wrong")
    return <span className="text-red-300 font-bold">✗</span>;
  return <span className="text-amber-200 font-bold">?</span>;
}

function Standings({ players, me }: { players: Player[]; me: Player }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <h3 className="font-bold mb-3">Ranking</h3>
      <ol className="space-y-1.5">
        {sorted.map((p, i) => (
          <li
            key={p.id}
            className={`flex justify-between items-center px-3 py-2 rounded-lg ${
              p.id === me.id ? "bg-fuchsia-500/20" : "bg-black/20"
            }`}
          >
            <span>
              <span className="text-purple-100/60 mr-2">#{i + 1}</span>
              {p.name}
            </span>
            <span className="font-bold text-fuchsia-200">{p.score} pts</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PlayerFinished({ players, me }: { players: Player[]; me: Player }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const won = winner?.id === me.id;
  return (
    <div className="max-w-md mx-auto text-center space-y-6 pt-12 pb-10">
      <h1 className="text-4xl font-black">
        {won ? "🏆 ¡Ganaste!" : "¡Fin de la partida!"}
      </h1>
      <p className="text-purple-100/80">
        {won
          ? "Sos el que más conoce al resto. Llevate el premio."
          : `Ganador: ${winner?.name ?? "—"}.`}
      </p>
      <Standings players={players} me={me} />
    </div>
  );
}
