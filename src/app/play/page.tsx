"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";

export default function PlayLandingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <main className="min-h-screen p-6 sm:p-8 bg-linear-to-br from-indigo-950 via-purple-950 to-fuchsia-900 text-white">
      <div className="max-w-md mx-auto">
        <PageHeader />
      </div>
      <div className="flex flex-col items-center justify-center pt-8">
      <div className="w-full max-w-md bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-8 space-y-6">
        <h1 className="text-3xl font-bold">Unirme a una partida</h1>
        <p className="text-purple-100/70 text-sm">
          Ingresá el código que aparece en la pantalla del organizador.
        </p>
        <input
          autoFocus
          maxLength={5}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCDE"
          className="w-full text-center text-4xl font-black tracking-[0.4em] bg-black/30 border border-white/10 rounded-2xl py-4 outline-none focus:border-fuchsia-400"
        />
        <button
          onClick={() => code.length === 5 && router.push(`/play/${code}`)}
          disabled={code.length !== 5}
          className="w-full px-6 py-3 rounded-2xl bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-40 transition font-semibold"
        >
          Continuar
        </button>
      </div>
      </div>
    </main>
  );
}
