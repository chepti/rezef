"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";

type Member = { id: number; nickname: string; domain: string; joinedAt: string; submitted: number };

// התלמידים שהצטרפו לקבוצה בקוד. המורה רואה כינוי ודומיין בלבד, יכולה לתקן כינוי לא מתאים או להסיר תלמיד.
export default function GroupMembers({ groupId }: { groupId: number }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ id: number; value: string } | null>(null);

  const load = useCallback(() => {
    fetch(`/api/groups/${groupId}/members`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { members: Member[] }) => setMembers(d.members))
      .catch(() => setError("לא הצלחנו לטעון את רשימת התלמידים"));
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  async function send(id: number, method: "PATCH" | "DELETE", body?: unknown) {
    setError("");
    const res = await fetch(`/api/members/${id}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "הפעולה נכשלה");
      return;
    }
    setEditing(null);
    load();
  }

  return (
    <section aria-label="תלמידים" className="lg:col-span-2 border-t border-line pt-4">
      <h2 className="mb-2 text-base font-bold" data-tip="תלמידים שהצטרפו עם קוד הקבוצה. נשמרים כינוי ודומיין בית הספר בלבד">
        תלמידים {members && <span className="font-normal text-muted tabular-nums">({members.length})</span>}
      </h2>
      {error && <p className="mb-2 text-sm text-coral">{error}</p>}
      {members === null && !error && <p className="text-sm text-muted">טוענים…</p>}
      {members && members.length === 0 && (
        <p className="text-sm text-muted">עדיין אין תלמידים. הם נכנסים בכתובת ‎/s עם חשבון Google של בית הספר, ומזינים את קוד הקבוצה.</p>
      )}
      {members && members.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-2xl border border-line px-3 py-2">
              {editing?.id === m.id ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(m.id, "PATCH", { nickname: editing.value });
                  }}
                >
                  <input
                    className="field !py-1 text-sm"
                    value={editing.value}
                    onChange={(e) => setEditing({ id: m.id, value: e.target.value })}
                    maxLength={24}
                    autoFocus
                    aria-label="כינוי"
                  />
                  <button className="btn-icon !p-1.5" type="submit" aria-label="שמירת הכינוי" data-tip="שמירה">
                    <Check size={16} strokeWidth={2} />
                  </button>
                </form>
              ) : (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.nickname}</span>
                  <span className="block truncate text-[0.7rem] text-muted">
                    <span dir="ltr">{m.domain}</span>
                    {m.submitted > 0 ? ` · ${m.submitted} מטלות הוגשו` : ""}
                  </span>
                </span>
              )}
              {editing?.id !== m.id && (
                <button className="btn-icon !p-1.5" aria-label="עריכת הכינוי" data-tip="עריכת הכינוי" onClick={() => setEditing({ id: m.id, value: m.nickname })}>
                  <Pencil size={15} strokeWidth={2} />
                </button>
              )}
              <button
                className="btn-icon !p-1.5"
                aria-label="הסרה מהקבוצה"
                data-tip="הסרה מהקבוצה (הסימונים שלו יימחקו)"
                onClick={() => {
                  if (window.confirm(`להסיר את ${m.nickname} מהקבוצה? סימוני ההגשה שלו יימחקו.`)) send(m.id, "DELETE");
                }}
              >
                <X size={15} strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
