"use client";

import React, { useMemo, useState } from "react";
import CefrTextTypeControls from "./_components/CefrTextTypeControls";

type ExerciseVariant = {
  prompt: string;
  options?: string[] | null;
};

type ExerciseItem = {
  id: number;
  type: string;
  skill: string;
  standard: ExerciseVariant;
  adapted: ExerciseVariant;
  answer: any;
};

export default function Page() {
  const [cefrLevel, setCefrLevel] = useState("B1");
  const [textType, setTextType] = useState("article");
  const [topic, setTopic] = useState("School phone policy");
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ExerciseItem[] | null>(null);
  const [raw, setRaw] = useState<any>(null);

  const payload = useMemo(() => {
    const p: any = {
      cefrLevel,
      level: cefrLevel, // back-compat
      textType,
      topic,
    };
    if (inputText.trim()) p.inputText = inputText.trim();
    return p;
  }, [cefrLevel, textType, topic, inputText]);

  async function run() {
    setLoading(true);
    setError(null);
    setItems(null);
    setRaw(null);

    try {
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      setRaw(data);
      setItems(Array.isArray(data?.items) ? data.items : null);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function renderOptions(opts?: string[] | null) {
    if (!opts || !opts.length) return null;
    return (
      <ul className="mt-2 list-disc pl-5 text-sm opacity-90">
        {opts.map((o, idx) => (
          <li key={idx}>{o}</li>
        ))}
      </ul>
    );
  }

  function renderAnswer(a: any) {
    if (Array.isArray(a)) return a.join("; ");
    if (a === null || a === undefined) return "";
    return String(a);
  }

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Aontas ESL</h1>
        <p className="text-sm opacity-80">
          CEFR A2–C2 + Cambridge-style text types. STANDARD + SUPPORTED share one answer key.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <CefrTextTypeControls
            cefrLevel={cefrLevel}
            setCefrLevel={setCefrLevel}
            textType={textType}
            setTextType={setTextType}
          />

          <div className="rounded-md border p-3 space-y-2">
            <label className="block text-sm font-medium">Topic</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
              placeholder="e.g., School phone policy"
            />

            <label className="block text-sm font-medium mt-3">
              Source text (optional — if provided, questions must use it exactly)
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full min-h-[160px] rounded-md border px-3 py-2 font-mono text-sm"
              placeholder="Paste the reading text here if you want zero hallucination."
            />

            <button
              onClick={run}
              disabled={loading}
              className="mt-2 w-full rounded-md border px-3 py-2 font-medium hover:bg-black/5 disabled:opacity-50"
            >
              {loading ? "Generating…" : "Generate exercises"}
            </button>

            {error ? (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-md border p-3 space-y-2">
          <div className="text-sm font-medium">Request payload</div>
          <pre className="overflow-auto rounded bg-black/5 p-3 text-xs">
            {JSON.stringify(payload, null, 2)}
          </pre>

          <div className="text-xs opacity-70">
            Tip: leave Source text empty to generate from topic; paste source text to lock answers.
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Exercises</h2>

        {!items ? (
          <p className="text-sm opacity-70">
            Run a generation to see results here.
          </p>
        ) : (
          <div className="space-y-4">
            {items.map((it) => (
              <div key={it.id} className="rounded-md border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs rounded bg-black/5 px-2 py-1">{it.type}</span>
                  <span className="text-xs rounded bg-black/5 px-2 py-1">{it.skill}</span>
                  <span className="text-xs opacity-70">#{it.id}</span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md bg-black/5 p-3">
                    <div className="text-xs font-semibold opacity-80">STANDARD</div>
                    <div className="mt-1 text-sm">{it.standard?.prompt}</div>
                    {renderOptions(it.standard?.options)}
                  </div>

                  <div className="rounded-md bg-black/5 p-3">
                    <div className="text-xs font-semibold opacity-80">SUPPORTED</div>
                    <div className="mt-1 text-sm">{it.adapted?.prompt}</div>
                    {renderOptions(it.adapted?.options)}
                  </div>
                </div>

                <div className="text-sm">
                  <span className="font-medium">Answer:</span>{" "}
                  <span className="opacity-90">{renderAnswer(it.answer)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {raw ? (
          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium">Raw JSON</summary>
            <pre className="mt-3 overflow-auto rounded bg-black/5 p-3 text-xs">
              {JSON.stringify(raw, null, 2)}
            </pre>
          </details>
        ) : null}
      </section>
    </main>
  );
}