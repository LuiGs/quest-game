import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-10 p-8 bg-linear-to-br from-indigo-950 via-purple-950 to-fuchsia-900 text-white">
      <div className="text-center max-w-xl">
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-4">
          Quest <span className="text-fuchsia-300">Game</span>
        </h1>
        <p className="text-lg sm:text-xl text-purple-100/80">
          ¿Cuánto sabés realmente de tu hermano? Respondé sobre vos y sobre los demás.
          Quien más conozca al resto, gana.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Link
          href="/host"
          className="flex-1 text-center px-6 py-4 rounded-2xl bg-fuchsia-500 hover:bg-fuchsia-400 transition font-semibold shadow-lg shadow-fuchsia-500/30"
        >
          Crear partida
        </Link>
        <Link
          href="/play"
          className="flex-1 text-center px-6 py-4 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur transition font-semibold border border-white/20"
        >
          Unirme
        </Link>
      </div>

      <p className="text-xs text-purple-200/60 absolute bottom-4">
        Hecho para hermanos. Funciona en cualquier dispositivo.
      </p>
    </main>
  );
}
