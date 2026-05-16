"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HostCreatePage() {
  const router = useRouter();
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [duration, setDuration] = useState(60);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createGame() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          totalQuestions,
          durationSeconds: duration,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error creando la partida");
      }
      // Persist the host token in localStorage scoped to this game
      localStorage.setItem(`host:${data.gameId}`, data.hostToken);
      router.push(`/host/${data.gameId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-linear-to-br from-indigo-950 via-purple-950 to-fuchsia-900 text-white">
      <div className="w-full max-w-md bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-8 space-y-6">
        <h1 className="text-3xl font-bold">Nueva partida</h1>
        <p className="text-purple-100/70 text-sm">
          Vas a generar un código y un QR. Compartilos con los jugadores.
          Lo ideal: abrí esta pantalla en una compu conectada a la TV.
        </p>

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm text-purple-100/80">
              Cantidad de preguntas
            </span>
            <input
              type="number"
              min={3}
              max={40}
              value={totalQuestions}
              onChange={(e) => setTotalQuestions(Number(e.target.value))}
              className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-fuchsia-400"
            />
          </label>
          <label className="block">
            <span className="text-sm text-purple-100/80">
              Tiempo por pregunta (segundos)
            </span>
            <input
              type="number"
              min={15}
              max={180}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-fuchsia-400"
            />
          </label>
        </div>

        {error && (
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={createGame}
          disabled={creating}
          className="w-full px-6 py-3 rounded-2xl bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-50 transition font-semibold"
        >
          {creating ? "Creando…" : "Crear partida"}
        </button>
      </div>
    </main>
  );
}
