"use client";

import React from "react";
import { CEFR_LEVELS, TEXT_TYPES } from "../../lib/cefrCambridge";

const LABELS: Record<string, string> = {
  story: "Story",
  short_message: "Short message / note",
  email_informal: "Email (informal)",
  email_formal: "Email (formal)",
  article: "Article",
  review: "Review",
  report: "Report",
  essay: "Essay",
};

export default function CefrTextTypeControls(props: {
  cefrLevel: string;
  setCefrLevel: (v: string) => void;
  textType: string;
  setTextType: (v: string) => void;
}) {
  const { cefrLevel, setCefrLevel, textType, setTextType } = props;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div>
        <label className="block text-sm font-medium">CEFR level</label>
        <select
          value={cefrLevel}
          onChange={(e) => setCefrLevel(e.target.value)}
          className="mt-1 w-full rounded-md border px-3 py-2"
        >
          {CEFR_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {lvl}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Text type</label>
        <select
          value={textType}
          onChange={(e) => setTextType(e.target.value)}
          className="mt-1 w-full rounded-md border px-3 py-2"
        >
          {TEXT_TYPES.map((t) => (
            <option key={t} value={t}>
              {LABELS[t] ?? String(t).replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs opacity-80">
        Cambridge-style formats: emails need subject/greeting/sign-off; reports need headings.
      </p>
    </div>
  );
}