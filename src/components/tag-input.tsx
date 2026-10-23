"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

export const DEFAULT_TAG_SUGGESTIONS = ['חנ"מ', 'חמ"ד', "ממלכתי", "חרדי"];

// תגיות חופשיות כצ'יפים, עם הצעות מוכנות. Enter או פסיק מוסיפים.
export default function TagInput({
  value,
  onChange,
  suggestions = DEFAULT_TAG_SUGGESTIONS,
  placeholder = "הוסיפו תגית",
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const t = raw.trim().slice(0, 30);
    if (!t || value.includes(t) || value.length >= 12) return;
    onChange([...value, t]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-3xl border border-line bg-white px-2.5 py-1.5 focus-within:border-blue focus-within:ring-4 focus-within:ring-blue-soft">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-blue-soft text-blue-dark text-sm ps-3 pe-1 py-0.5">
            {t}
            <button
              type="button"
              className="btn-icon !p-0.5"
              aria-label={`הסרת ${t}`}
              data-tip="הסרה"
              onClick={() => onChange(value.filter((x) => x !== t))}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </span>
        ))}
        <input
          className="min-w-[7rem] flex-1 bg-transparent outline-none text-sm py-1"
          value={draft}
          placeholder={value.length ? "" : placeholder}
          aria-label="תגית חדשה"
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) add(v.slice(0, -1));
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions
          .filter((s) => !value.includes(s))
          .map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-line text-muted hover:border-blue hover:text-blue-dark text-xs px-2.5 py-1 transition"
            >
              <Plus size={12} strokeWidth={2} />
              {s}
            </button>
          ))}
      </div>
    </div>
  );
}
