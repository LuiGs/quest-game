"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import type { Question } from "@/lib/types";

const ADMIN_KEY = "admin-token";

function subscribeToStorage(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function useAdminToken(): [string | null, (t: string) => void, () => void] {
  const token = useSyncExternalStore(
    subscribeToStorage,
    () =>
      typeof window === "undefined" ? null : localStorage.getItem(ADMIN_KEY),
    () => null
  );
  function set(t: string) {
    localStorage.setItem(ADMIN_KEY, t);
    window.dispatchEvent(new StorageEvent("storage"));
  }
  function clear() {
    localStorage.removeItem(ADMIN_KEY);
    window.dispatchEvent(new StorageEvent("storage"));
  }
  return [token, set, clear];
}

export default function QuestionBankPage() {
  const [adminToken, setAdminToken, clearAdminToken] = useAdminToken();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    const res = await fetch("/api/questions");
    const data = await res.json();
    setQuestions((data.questions as Question[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return questions.filter((q) => {
      if (!showArchived && q.archived) return false;
      if (!f) return true;
      return (
        q.prompt.toLowerCase().includes(f) ||
        (q.category ?? "").toLowerCase().includes(f)
      );
    });
  }, [questions, filter, showArchived]);

  const active = questions.filter((q) => !q.archived).length;

  async function addQuestion(prompt: string, category: string) {
    setError(null);
    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adminToken, prompt, category }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Error");
      return false;
    }
    await reload();
    return true;
  }

  async function patchQuestion(id: string, patch: Partial<Question>) {
    setError(null);
    const res = await fetch(`/api/questions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adminToken, ...patch }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Error");
      return false;
    }
    await reload();
    return true;
  }

  async function deleteQuestion(id: string) {
    if (!confirm("¿Borrar esta pregunta para siempre?")) return;
    setError(null);
    const res = await fetch(`/api/questions/${id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adminToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Error");
      return;
    }
    await reload();
  }

  return (
    <main className="min-h-screen bg-linear-to-br from-indigo-950 via-purple-950 to-fuchsia-900 text-white p-6 sm:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-purple-100/70 hover:text-white text-sm"
          >
            ← Volver
          </Link>
          <h1 className="text-3xl font-black flex-1">Banco de preguntas</h1>
          {adminToken && (
            <button
              onClick={clearAdminToken}
              className="text-xs text-purple-100/60 hover:text-red-300"
            >
              Cerrar sesión admin
            </button>
          )}
        </div>

        <p className="text-sm text-purple-100/70">
          {active} preguntas activas
          {showArchived &&
            ` (+ ${questions.length - active} archivadas mostradas)`}
          .{" "}
          {adminToken
            ? "Modo admin — podés agregar, editar y archivar."
            : "Modo solo lectura. Tipeá tu token para editar."}
        </p>

        {!adminToken && <AdminLoginForm onSet={setAdminToken} />}

        {error && (
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {adminToken && <AddForm onAdd={addQuestion} />}

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar…"
            className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-fuchsia-400"
          />
          <label className="flex items-center gap-2 text-sm bg-black/20 border border-white/10 rounded-xl px-3 py-2">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            mostrar archivadas
          </label>
        </div>

        {loading ? (
          <p className="text-purple-100/70">Cargando…</p>
        ) : (
          <ul className="space-y-2">
            {filtered.length === 0 && (
              <li className="text-purple-100/60 text-sm">Nada para mostrar.</li>
            )}
            {filtered.map((q) => (
              <QuestionRow
                key={q.id}
                question={q}
                isAdmin={!!adminToken}
                onPatch={(patch) => patchQuestion(q.id, patch)}
                onDelete={() => deleteQuestion(q.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function AdminLoginForm({ onSet }: { onSet: (t: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row gap-2">
      <input
        type="password"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="ADMIN_TOKEN"
        className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-fuchsia-400"
      />
      <button
        onClick={() => val && onSet(val)}
        className="px-4 py-2 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 font-semibold transition"
      >
        Desbloquear
      </button>
    </div>
  );
}

function AddForm({
  onAdd,
}: {
  onAdd: (prompt: string, category: string) => Promise<boolean>;
}) {
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState("");
  async function submit() {
    if (!prompt.trim()) return;
    const ok = await onAdd(prompt.trim(), category.trim());
    if (ok) {
      setPrompt("");
      setCategory("");
    }
  }
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
      <h2 className="font-bold text-sm uppercase tracking-widest text-purple-100/70">
        Nueva pregunta
      </h2>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Prompt"
          className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-fuchsia-400"
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Categoría (opcional)"
          className="sm:w-44 bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-fuchsia-400"
        />
        <button
          onClick={submit}
          disabled={!prompt.trim()}
          className="px-5 py-2 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-40 font-semibold transition"
        >
          Agregar
        </button>
      </div>
    </div>
  );
}

function QuestionRow({
  question,
  isAdmin,
  onPatch,
  onDelete,
}: {
  question: Question;
  isAdmin: boolean;
  onPatch: (patch: Partial<Question>) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(question.prompt);
  const [category, setCategory] = useState(question.category ?? "");

  async function save() {
    const ok = await onPatch({ prompt, category: category || null });
    if (ok) setEditing(false);
  }

  return (
    <li
      className={`bg-white/5 border rounded-xl px-4 py-3 ${
        question.archived
          ? "border-white/5 opacity-60"
          : "border-white/10"
      }`}
    >
      {editing ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 outline-none focus:border-fuchsia-400"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="cat."
            className="sm:w-32 bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 outline-none focus:border-fuchsia-400"
          />
          <button
            onClick={save}
            className="px-3 py-1 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 text-sm font-semibold"
          >
            Guardar
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setPrompt(question.prompt);
              setCategory(question.category ?? "");
            }}
            className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-sm"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="font-medium">{question.prompt}</p>
            <p className="text-xs text-purple-100/50">
              {question.category ?? "—"}
              {question.archived && " · archivada"}
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-1.5">
              <button
                onClick={() => setEditing(true)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-xs"
              >
                Editar
              </button>
              <button
                onClick={() => onPatch({ archived: !question.archived })}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-xs"
              >
                {question.archived ? "Restaurar" : "Archivar"}
              </button>
              <button
                onClick={onDelete}
                className="px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-200 text-xs"
              >
                Borrar
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
