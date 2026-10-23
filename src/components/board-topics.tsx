"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";

export type Topic = { id: number; name: string; color: string };

const MAX_STRIPES = 24;

function Segment({
  topic,
  lessonCount,
  active,
  onSelect,
  onRename,
}: {
  topic: Topic;
  lessonCount: number;
  active: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
}) {
  // הנושא הוא גם יעד לשחרור: גוררים שיעור על נושא כדי להעביר אותו אליו.
  const { setNodeRef, isOver } = useDroppable({ id: `topic-${topic.id}` });
  const [name, setName] = useState(topic.name);
  const stripes = Math.max(1, Math.min(lessonCount, MAX_STRIPES));

  return (
    <div style={{ flexGrow: Math.max(1, lessonCount), flexBasis: 0 }} className="min-w-[8rem]">
      <div
        ref={setNodeRef}
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => e.key === "Enter" && onSelect()}
        style={
          active
            ? { background: topic.color, color: "#fff", boxShadow: `0 6px 16px ${topic.color}55` }
            : { background: `${topic.color}1f`, color: "var(--ink)" }
        }
        className={`rounded-2xl px-3.5 py-2 cursor-pointer transition-all ${isOver ? "ring-4 ring-offset-1" : ""}`}
      >
        <div className="flex items-center gap-1.5">
          {active ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name !== topic.name && onRename(name)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="min-w-0 flex-1 bg-transparent font-bold outline-none placeholder:text-white/70"
              aria-label="שם הנושא"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate font-bold">{topic.name}</span>
          )}
        </div>
        <div className="mt-1.5 flex gap-1 h-1.5" aria-hidden>
          {Array.from({ length: stripes }).map((_, i) => (
            <span
              key={i}
              className="flex-1 rounded-full"
              style={{ background: active ? "rgba(255,255,255,0.6)" : topic.color, opacity: lessonCount === 0 ? 0.25 : 1 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TopicBar({
  topics,
  lessonCounts,
  currentId,
  onSelect,
  onRename,
  onAdd,
}: {
  topics: Topic[];
  lessonCounts: Record<number, number>;
  currentId: number | null;
  onSelect: (id: number) => void;
  onRename: (id: number, name: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-start gap-2" role="tablist" aria-label="נושאים">
      <div className="flex flex-1 gap-2 min-w-0 overflow-x-auto no-scrollbar py-1.5 px-1">
        {topics.map((t) => (
          <Segment
            key={t.id}
            topic={t}
            lessonCount={lessonCounts[t.id] ?? 0}
            active={t.id === currentId}
            onSelect={() => onSelect(t.id)}
            onRename={(name) => onRename(t.id, name)}
          />
        ))}
      </div>
      <button className="btn btn-ghost !px-3 mt-1.5 shrink-0" data-tip="נושא חדש" aria-label="נושא חדש" onClick={onAdd}>
        <Plus size={18} strokeWidth={2} /> נושא
      </button>
    </div>
  );
}
