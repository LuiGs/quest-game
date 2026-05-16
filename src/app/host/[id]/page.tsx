"use client";

import { useEffect, useMemo, useState, use, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import Link from "next/link";
import { useGameState } from "@/lib/useGameState";
import type { Answer, Game, GameQuestion, Player, Prize } from "@/lib/types";

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
  const { game, players, questions, answers, prizes, loading } =
    useGameState(id);
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
          game={game}
          question={questions.find((q) => q.idx === game.question_index)}
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
          prizes={prizes}
        />
      )}
      {game.status === "finished" && (
        <FinishedView
          gameId={id}
          hostToken={hostToken}
          players={players}
          prizes={prizes}
        />
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
            <div className="mt-auto space-y-2">
              <button
                onClick={start}
                disabled={starting || players.length < 2}
                className="w-full px-6 py-4 rounded-2xl bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-40 transition font-semibold text-lg"
              >
                {starting
                  ? "Empezando…"
                  : players.length < 2
                  ? "Necesitás al menos 2 jugadores"
                  : "Empezar partida"}
              </button>
              <Link
                href="/host/bank"
                className="block text-center w-full px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm transition"
              >
                Gestionar banco de preguntas
              </Link>
            </div>
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

/**
 * Countdown that respects pause + extra seconds. `game` is the realtime game
 * row, so any pause / +30s / etc made by the host immediately propagates.
 */
function useCountdown(game: Game) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  if (!game.question_started_at) return game.question_duration_s;
  const startMs = new Date(game.question_started_at).getTime();
  // If paused, freeze "now" at the pause moment.
  const effectiveNow = game.paused_started_at
    ? new Date(game.paused_started_at).getTime()
    : now;
  const elapsedMs = effectiveNow - startMs - (game.paused_ms_total ?? 0);
  const total = game.question_duration_s + (game.question_extra_s ?? 0);
  return Math.max(0, total - Math.floor(elapsedMs / 1000));
}

function PlayingView({
  gameId,
  hostToken,
  game,
  question,
  players,
  answers,
}: {
  gameId: string;
  hostToken: string | null;
  game: Game;
  question: GameQuestion | undefined;
  players: Player[];
  answers: Answer[];
}) {
  const remaining = useCountdown(game);
  const paused = !!game.paused_started_at;

  const submittedByPlayer = useMemo(() => {
    if (!question) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const a of answers) {
      if (a.question_id !== question.id) continue;
      m.set(a.author_id, (m.get(a.author_id) ?? 0) + 1);
    }
    return m;
  }, [answers, question]);

  const owedPerPlayer = players.length;

  async function hostAction(action: string, extra?: Record<string, unknown>) {
    if (!hostToken) return;
    await fetch(`/api/games/${gameId}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hostToken, ...extra }),
    });
  }

  // Auto-end when timer hits 0 — only on host device, only when not paused.
  useEffect(() => {
    if (!hostToken) return;
    if (paused) return;
    if (remaining > 0) return;
    hostAction("end-question");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, hostToken, paused]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center text-purple-100/70 text-sm uppercase tracking-widest">
        <span>
          Pregunta {game.question_index + 1} / {game.total_questions}
        </span>
        <span
          className={
            paused
              ? "text-amber-200 text-2xl font-bold"
              : remaining <= 5
              ? "text-red-300 text-2xl font-bold"
              : "text-2xl font-bold"
          }
        >
          {paused ? "⏸ pausa" : `${remaining}s`}
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
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => hostAction(paused ? "resume" : "pause")}
            className="px-5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-100 font-medium transition"
          >
            {paused ? "▶ Reanudar" : "⏸ Pausar"}
          </button>
          <button
            onClick={() => hostAction("add-time", { seconds: 30 })}
            className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 transition"
          >
            +30s
          </button>
          <button
            onClick={() => hostAction("skip")}
            className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 transition"
          >
            Saltar pregunta
          </button>
          <button
            onClick={() => hostAction("end-question")}
            className="px-5 py-2.5 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 font-semibold transition"
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
  prizes,
}: {
  gameId: string;
  hostToken: string | null;
  question: GameQuestion | undefined;
  questionIndex: number;
  totalQuestions: number;
  players: Player[];
  answers: Answer[];
  prizes: Prize[];
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
  const pendingCount = guesses.filter(
    (g) => g.peer_vote == null && g.verdict !== "correct" && g.verdict !== "wrong"
  ).length;

  async function overrideVerdict(
    answerId: string,
    verdict: "correct" | "partial" | "wrong"
  ) {
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
        {pendingCount > 0 && (
          <span className="text-amber-200 normal-case tracking-normal">
            Esperando {pendingCount} voto{pendingCount === 1 ? "" : "s"}…
          </span>
        )}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
        <h2 className="text-3xl sm:text-5xl font-black">{question?.prompt}</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {players.map((target) => {
          const truth = selfByTarget.get(target.id);
          const targetGuesses = byTarget.get(target.id) ?? [];
          return (
            <div
              key={target.id}
              className="bg-white/5 border border-white/10 rounded-2xl p-5"
            >
              <div className="flex items-baseline justify-between mb-3 gap-2">
                <h3 className="font-bold text-lg">{target.name}</h3>
                <span className="text-xs text-purple-100/60 text-right">
                  Real:{" "}
                  <span className="text-fuchsia-200 font-semibold">
                    {truth?.text ?? "—"}
                  </span>
                </span>
              </div>
              <ul className="space-y-2">
                {targetGuesses.length === 0 && (
                  <li className="text-sm text-purple-100/50">
                    Nadie respondió sobre {target.name}.
                  </li>
                )}
                {targetGuesses.map((g) => {
                  const author = playerById.get(g.author_id);
                  return (
                    <li
                      key={g.id}
                      className="bg-black/20 rounded-lg p-2.5 space-y-1.5"
                    >
                      <div className="flex justify-between gap-2 text-sm">
                        <span>
                          <span className="text-purple-100/70">
                            {author?.name}:
                          </span>{" "}
                          <span className="font-medium">{g.text}</span>
                        </span>
                        <VerdictBadge verdict={g.verdict} peer={g.peer_vote} />
                      </div>
                      {hostToken && (
                        <div className="flex gap-1.5 text-xs">
                          <button
                            onClick={() => overrideVerdict(g.id, "correct")}
                            className="px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-200 transition"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => overrideVerdict(g.id, "partial")}
                            className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/30 text-amber-200 transition"
                          >
                            ~
                          </button>
                          <button
                            onClick={() => overrideVerdict(g.id, "wrong")}
                            className="px-2 py-1 rounded bg-red-500/15 hover:bg-red-500/30 text-red-200 transition"
                          >
                            ✗
                          </button>
                          <span className="text-purple-100/40 ml-auto">
                            override
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <Ranking
        players={players}
        gameId={gameId}
        hostToken={hostToken}
      />

      {hostToken && (
        <PrizePanel
          gameId={gameId}
          hostToken={hostToken}
          players={players}
          prizes={prizes}
        />
      )}

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

function VerdictBadge({
  verdict,
  peer,
}: {
  verdict: string | null;
  peer: string | null;
}) {
  if (verdict === "correct")
    return (
      <span className="text-emerald-300 font-bold whitespace-nowrap">
        ✓ 2pt
      </span>
    );
  if (verdict === "partial")
    return (
      <span className="text-amber-200 font-bold whitespace-nowrap">
        ~ 1pt
      </span>
    );
  if (verdict === "wrong")
    return <span className="text-red-300/80 font-bold">✗</span>;
  if (peer == null)
    return (
      <span className="text-purple-100/50 italic text-xs">esperando…</span>
    );
  return <span className="text-purple-100/50">?</span>;
}

function Ranking({
  players,
  gameId,
  hostToken,
}: {
  players: Player[];
  gameId?: string;
  hostToken?: string | null;
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  async function adjust(playerId: string, delta: number) {
    if (!hostToken || !gameId) return;
    await fetch(`/api/games/${gameId}/score-adjust`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hostToken, playerId, delta }),
    });
  }
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <h3 className="font-bold mb-3">Ranking</h3>
      <ol className="space-y-1.5">
        {sorted.map((p, i) => (
          <li
            key={p.id}
            className="flex justify-between items-center px-3 py-2 rounded-lg bg-black/20 gap-2"
          >
            <span className="flex-1 min-w-0">
              <span className="text-purple-100/60 mr-2">#{i + 1}</span>
              <span className="font-medium">{p.name}</span>
              {p.score_bonus !== 0 && (
                <span className="ml-2 text-xs text-amber-200">
                  ({p.score_bonus > 0 ? "+" : ""}
                  {p.score_bonus} manual)
                </span>
              )}
            </span>
            <span className="font-bold text-fuchsia-200 whitespace-nowrap">
              {p.score} pts
            </span>
            {hostToken && gameId && (
              <span className="flex gap-1">
                <button
                  onClick={() => adjust(p.id, -1)}
                  className="w-7 h-7 rounded bg-white/5 hover:bg-white/15 text-xs"
                  title="-1 punto manual"
                >
                  −
                </button>
                <button
                  onClick={() => adjust(p.id, 1)}
                  className="w-7 h-7 rounded bg-white/5 hover:bg-white/15 text-xs"
                  title="+1 punto manual"
                >
                  +
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function PrizePanel({
  gameId,
  hostToken,
  players,
  prizes,
}: {
  gameId: string;
  hostToken: string;
  players: Player[];
  prizes: Prize[];
}) {
  const [recipient, setRecipient] = useState<string>(players[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const playerById = useMemo(
    () => new Map(players.map((p) => [p.id, p.name])),
    [players]
  );
  async function give() {
    if (!recipient || !label.trim()) return;
    await fetch(`/api/games/${gameId}/prizes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hostToken, recipientId: recipient, label }),
    });
    setLabel("");
  }
  async function remove(prizeId: string) {
    await fetch(`/api/games/${gameId}/prizes`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hostToken, prizeId }),
    });
  }
  return (
    <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl p-5 space-y-3">
      <h3 className="font-bold">🏆 Entregar premio</h3>
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 outline-none"
        >
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ej: alfajor, comodín, beso de mamá"
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 outline-none"
        />
        <button
          onClick={give}
          disabled={!label.trim()}
          className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-semibold disabled:opacity-50 transition"
        >
          Entregar
        </button>
      </div>
      {prizes.length > 0 && (
        <ul className="space-y-1 text-sm">
          {prizes.map((pr) => (
            <li
              key={pr.id}
              className="flex justify-between items-center bg-black/20 rounded-lg px-3 py-1.5"
            >
              <span>
                <span className="font-semibold text-amber-200">
                  {playerById.get(pr.recipient_id) ?? "—"}
                </span>
                : {pr.label}
              </span>
              <button
                onClick={() => remove(pr.id)}
                className="text-purple-100/40 hover:text-red-300 text-xs"
                title="Quitar"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FinishedView({
  gameId,
  hostToken,
  players,
  prizes,
}: {
  gameId: string;
  hostToken: string | null;
  players: Player[];
  prizes: Prize[];
}) {
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
      <Ranking players={players} gameId={gameId} hostToken={hostToken} />
      {hostToken && (
        <PrizePanel
          gameId={gameId}
          hostToken={hostToken}
          players={players}
          prizes={prizes}
        />
      )}
    </div>
  );
}
