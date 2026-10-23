"use client";

import { useState } from "react";
import TagInput from "./tag-input";
import type { Terms } from "./board-publish";

export type SettingsGroup = {
  id: number;
  name: string;
  className: string | null;
  subjectName: string | null;
  tags: string[];
};

// הגדרות הקבוצה: שם, כיתה, תחום ותגיות. הכיתה והתחום קובעים מה המחסן מציע ואיך פריטים מתויגים,
// והתגיות נשלחות עם כל פריט שמפרסמים מהרצף לחומר פתוח.
export default function GroupSettings({
  group,
  terms,
  onSaved,
  onClose,
}: {
  group: SettingsGroup;
  terms: Terms;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [className, setClassName] = useState(group.className ?? "");
  const [subjectName, setSubjectName] = useState(group.subjectName ?? "");
  const [tags, setTags] = useState<string[]>(group.tags ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, className: className || null, subjectName: subjectName || null, tags }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "השמירה נכשלה");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-[110rem] mb-5 grid gap-3 rounded-3xl border border-line bg-white p-5 md:grid-cols-4">
      <input className="field md:col-span-2" value={name} onChange={(e) => setName(e.target.value)} aria-label="שם הקבוצה" />
      <select className="field" value={className} onChange={(e) => setClassName(e.target.value)} aria-label="כיתה">
        <option value="">כיתה</option>
        {terms.classes.map((c) => (
          <option key={c} value={c}>
            כיתה {c}
          </option>
        ))}
      </select>
      <select className="field" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} aria-label="תחום דעת">
        <option value="">תחום דעת</option>
        {terms.subjects.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <div className="md:col-span-4">
        <p className="mb-1.5 text-sm text-muted" data-tip="יישמרו כתגיות בפוסטים שתפרסמו מהרצף לחומר פתוח">
          תגיות נוספות
        </p>
        <TagInput value={tags} onChange={setTags} />
      </div>
      {error && <p className="md:col-span-4 text-sm text-coral">{error}</p>}
      <div className="md:col-span-4 flex gap-2">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "שומרים…" : "שמירה"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={onClose}>
          סגירה
        </button>
      </div>
    </form>
  );
}
