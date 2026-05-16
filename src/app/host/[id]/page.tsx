"use client";

import { useEffect, useMemo, useState, use, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import { useGameState } from "@/lib/useGameState";
import type { Answer, GameQuestion, Player } from "@/lib/types";

function subscribeToStorage(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function useHostToken(gameId: string): string | null {
  const key = `host:${gameId}`;
  return useSyncExternalStore(
    subscribeToStorage,
    () => (typeof window === "undefined" ? null : localStorage.getItem(key)),
    () => null
  );
}

export default function HostGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { game, players, questions, answers, loading } = useGameState(id);
  const hostToken = useHostToken(id);

  if (loading || !game) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        Cargando…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-linear-to-br from-indigo-950 via-purple-950 to-fuchsia-900 text-white p-6 sm:p-10">
      {game.status === "lobby" && (
        <Lobby
          gameId={id}
          code={game.code}
          players={players}
          hostToken={hostToken}
        />
      )}
      {game.status === "playing" && (
        <PlayingView
          gameId={id}
          hostToken={hostToken}
          questionStartedAt={game.question_started_at}
          duration={game.question_duration_s}
          question={questions.find((q) => q.idx === game.question_index)}
          questionIndex={game.question_index}
          totalQuestions={game.total_questions}
          players={players}
          answers={answers}
        />
      )}
      {game.status === "reveal" && (
        <RevealView
          gameId={id}
          hostToken={hostToken}
          question={questions.find((q) => q.idx === game.question_index)}
          questionIndex={game.question_index}
          totalQuestions={game.total_questions}
          players={players}
          answers={answers}
        />
      )}
      {game.status === "finished" && (
        <FinishedView players={players} />
      )}
    </main>
  );
}

function Lobby({
  gameId,
  code,
  players,
  hostToken,
}: {
  gameId: string;
  code: string;
  players: Player[];
  hostToken: string | null;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/play/${code}`;
  }, [code]);

  useEffect(() => {
    if (!joinUrl) return;
    QRCode.toDataURL(joinUrl, { width: 360, margin: 1 }).then(setQrDataUrl);
  }, [joinUrl]);

  async function start() {
    if (!hostToken) {
      setError("Sos espectador (sin host token en este dispositivo).");
      return;
    }
    setStarting(true);
    setError(null);
    const res = await fetch(`/api/games/${gameId}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hostToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Error");
      setStarting(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-10 max-w-6xl mx-auto">
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col items-center">
        <p className="text-sm uppercase tracking-widest text-purple-200/70">
          Código de partida
        </p>
        <p className="text-7xl sm:text-8xl font-black tracking-widest mt-2">
          {code}
        </p>
        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt="QR para unirse"
            className="rounded-2xl bg-white p-2 mt-6"
            width={280}
            height={280}
          />
        )}
        <p className="text-center text-purple-100/70 text-sm mt-4 break-all">
          {joinUrl}
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col">
        <h2 className="text-2xl font-bold mb-4">
          Jugadores ({players.length})
        </h2>
        {players.length === 0 ? (
          <p className="text-purple-100/70">
            Esperando que se unan…
          </p>
        ) : (
          <ul className="space-y-2 mb-6">
            {players.map((p) => (
              <li
                key={p.id}
                className="px-4 py-3 bg-black/30 rounded-xl border border-white/5 flex items-center gap-3"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-medium">{p.name}</span>
              </li>
            ))}
          </ul>
        )}

        {hostToken ? (
          <>
            {error && (
              <p className="text-sm text-red-300 mb-3">{error}</p>
            )}
            <button
              onClick={start}
              disabled={starting || players.length < 2}
              className="mt-auto px-6 py-4 rounded-2xl bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-40 transition font-semibold text-lg"
            >
              {starting
                ? "Empezando…"
                : players.length < 2
                ? "Necesitás al menos 2 jugadores"
                : "Empezar partida"}
            </button>
          </>
        ) : (
          <p className="mt-auto text-purple-200/60 text-sm">
            Modo espectador (este dispositivo no controla la partida).
          </p>
        )}
      </div>
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
  const elapsedMs = now - new Date(startedAt).getTime();
  const remaining = Math.max(0, durationSeconds - Math.floor(elapsedMs / 1000));
  return remaining;
}

function PlayingView({
  gameId,
  hostToken,
  questionStartedAt,
  duration,
  question,
  questionIndex,
  totalQuestions,
  players,
  answers,
}: {
  gameId: string;
  hostToken: string | null;
  questionStartedAt: string | null;
  duration: number;
  question: GameQuestion | undefined;
  questionIndex: number;
  totalQuestions: number;
  players: Player[];
  answers: Answer[];
}) {
  const remaining = useCountdown(questionStartedAt, duration);
  const submittedByPlayer = useMemo(() => {
    if (!question) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const a of answers) {
      if (a.question_id !== question.id) continue;
      m.set(a.author_id, (m.get(a.author_id) ?? 0) + 1);
    }
    return m;
  }, [answers, question]);

  // Each player owes: 1 self answer + (players.length - 1) guesses = players.length
  const owedPerPlayer = players.length;

  async function endNow() {
    if (!hostToken) return;
    await fetch(`/api/games/${gameId}/end-question`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hostToken }),
    });
  }

  // Auto-end when timer hits 0 (host device only).
  useEffect(() => {
    if (!hostToken) return;
    if (remaining > 0) return;
    endNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, hostToken]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center text-purple-100/70 text-sm uppercase tracking-widest">
        <span>
          Pregunta {questionIndex + 1} / {totalQuestions}
        </span>
        <span
          className={
            remaining <= 5
              ? "text-red-300 text-2xl font-bold"
              : "text-2xl font-bold"
          }
        >
          {remaining}s
        </span>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
        <h2 className="text-4xl sm:text-6xl font-black">
          {question?.prompt ?? "…"}
        </h2>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {players.map((p) => {
          const got = submittedByPlayer.get(p.id) ?? 0;
          const done = got >= owedPerPlayer;
          return (
            <div
              key={p.id}
              className={`px-4 py-3 rounded-xl border flex items-center justify-between ${
                done
                  ? "bg-emerald-500/10 border-emerald-400/40"
                  : "bg-black/30 border-white/10"
              }`}
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-purple-100/70">
                {done ? "✓ listo" : `${got}/${owedPerPlayer}`}
              </span>
            </div>
          );
        })}
      </div>

      {hostToken && (
        <div className="text-center">
          <button
            onClick={endNow}
            className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 transition"
          >
            Cerrar pregunta ahora
          </button>
        </div>
      )}
    </div>
  );
}

function RevealView({
  gameId,
  hostToken,
  question,
  questionIndex,
  totalQuestions,
  players,
  answers,
}: {
  gameId: string;
  hostToken: string | null;
  question: GameQuestion | undefined;
  questionIndex: number;
  totalQuestions: number;
  players: Player[];
  answers: Answer[];
}) {
  const [advancing, setAdvancing] = useState(false);
  const playerById = useMemo(() => {
    const m = new Map<string, Player>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

  const questionAnswers = useMemo(() => {
    if (!question) return [];
    return answers.filter((a) => a.question_id === question.id);
  }, [answers, question]);

  const selfByTarget = useMemo(() => {
    const m = new Map<string, Answer>();
    for (const a of questionAnswers) {
      if (a.is_self) m.set(a.target_id, a);
    }
    return m;
  }, [questionAnswers]);

  const guesses = useMemo(
    () => questionAnswers.filter((a) => !a.is_self),
    [questionAnswers]
  );
  const pending = useMemo(
    () => guesses.filter((a) => a.verdict === "pending"),
    [guesses]
  );

  async function setVerdict(answerId: string, verdict: "correct" | "wrong") {
    if (!hostToken) return;
    await fetch(`/api/games/${gameId}/verdict`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hostToken, answerId, verdict }),
    });
  }

  async function next() {
    if (!hostToken) return;
    setAdvancing(true);
    await fetch(`/api/games/${gameId}/next`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hostToken }),
    });
    setAdvancing(false);
  }

  // Group guesses by target to show "what each player really said vs what
  // others guessed about them".
  const byTarget = useMemo(() => {
    const m = new Map<string, Answer[]>();
    for (const g of guesses) {
      const arr = m.get(g.target_id) ?? [];
      arr.push(g);
      m.set(g.target_id, arr);
    }
    return m;
  }, [guesses]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center text-purple-100/70 text-sm uppercase tracking-widest">
        <span>
          Pregunta {questionIndex + 1} / {totalQuestions} — Resultados
        </span>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
        <h2 className="text-3xl sm:text-5xl font-black">
          {question?.prompt}
        </h2>
      </div>

      {pending.length > 0 && hostToken && (
        <div className="bg-amber-500/10 border border-amber-400/40 rounded-3xl p-6 space-y-3">
          <h3 className="font-bold text-amber-200">
            Revisar manualmente ({pending.length})
          </h3>
          {pending.map((g) => {
            const author = playerById.get(g.author_id);
            const target = playerById.get(g.target_id);
            const truth = selfByTarget.get(g.target_id);
            return (
              <div
                key={g.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 bg-black/30 rounded-xl p-3"
              >
                <div className="flex-1 text-sm">
                  <span className="font-semibold">{author?.name}</span>
                  <span className="text-purple-100/60"> dijo sobre </span>
                  <span className="font-semibold">{target?.name}</span>
                  : <span className="font-bold text-fuchsia-200">{g.text}</span>
                  <span className="text-purple-100/60">
                    {" "}
                    (real: {truth?.text ?? "—"})
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setVerdict(g.id, "correct")}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold"
                  >
                    ✓ Acierta
                  </button>
                  <button
                    onClick={() => setVerdict(g.id, "wrong")}
                    className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-sm font-semibold"
                  >
                    ✗ Falla
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {players.map((target) => {
          const truth = selfByTarget.get(target.id);
          const targetGuesses = byTarget.get(target.id) ?? [];
          return (
            <div
              key={target.id}
              className="bg-white/5 border border-white/10 rounded-2xl p-5"
            >
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="font-bold text-lg">{target.name}</h3>
                <span className="text-xs text-purple-100/60">
                  Real: <span className="text-fuchsia-200 font-semibold">
                    {truth?.text ?? "—"}
                  </span>
                </span>
              </div>
              <ul className="space-y-1.5">
                {targetGuesses.length === 0 && (
                  <li className="text-sm text-purple-100/50">
                    Nadie respondió sobre {target.name}.
                  </li>
                )}
                {targetGuesses.map((g) => {
                  const author = playerById.get(g.author_id);
                  const color =
                    g.verdict === "correct"
                      ? "text-emerald-300"
                      : g.verdict === "wrong"
                      ? "text-red-300/80"
                      : "text-amber-200";
                  const symbol =
                    g.verdict === "correct"
                      ? "✓"
                      : g.verdict === "wrong"
                      ? "✗"
                      : "?";
                  return (
                    <li
                      key={g.id}
                      className="flex justify-between items-center text-sm"
                    >
                      <span>
                        <span className="text-purple-100/70">
                          {author?.name}:
                        </span>{" "}
                        {g.text}
                      </span>
                      <span className={`font-bold ${color}`}>{symbol}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <Ranking players={players} />

      {hostToken && (
        <div className="text-center">
          <button
            onClick={next}
            disabled={advancing}
            className="px-8 py-4 rounded-2xl bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-50 transition font-semibold text-lg"
          >
            {questionIndex + 1 >= totalQuestions
              ? "Ver resultado final"
              : "Siguiente pregunta"}
          </button>
        </div>
      )}
    </div>
  );
}

function Ranking({ players }: { players: Player[] }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <h3 className="font-bold mb-3">Ranking</h3>
      <ol className="space-y-1.5">
        {sorted.map((p, i) => (
          <li
            key={p.id}
            className="flex justify-between items-center px-3 py-2 rounded-lg bg-black/20"
          >
            <span>
              <span className="text-purple-100/60 mr-2">#{i + 1}</span>
              <span className="font-medium">{p.name}</span>
            </span>
            <span className="font-bold text-fuchsia-200">{p.score} pts</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FinishedView({ players }: { players: Player[] }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  return (
    <div className="max-w-3xl mx-auto text-center space-y-8">
      <h1 className="text-5xl sm:text-7xl font-black">¡Fin de la partida!</h1>
      {winner && (
        <p className="text-2xl">
          🏆 Ganador:{" "}
          <span className="text-fuchsia-300 font-black text-4xl">
            {winner.name}
          </span>{" "}
          con <span className="font-bold">{winner.score} pts</span>
        </p>
      )}
      <Ranking players={players} />
    </div>
  );
}
