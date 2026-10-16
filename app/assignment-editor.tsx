"use client";

import { FormEvent, useState } from "react";

const teachers = ["이주백.T", "박병민.T", "노대근.T"];

export default function AssignmentEditor({ row, refresh }: {
  row: { id: number; student_name: string; teacher_name: string; class_name: string; book_name: string };
  refresh: () => Promise<void>;
}) {
  const [teacherName, setTeacherName] = useState(row.teacher_name);
  const [className, setClassName] = useState(row.class_name);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm(`${row.student_name} 학생의 담당을 ${teacherName} · ${className}(으)로 변경할까요?`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/staff/roster", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-assignment", id: row.id, teacherName, className }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "변경하지 못했습니다.");
      await refresh();
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "변경하지 못했습니다.");
    } finally { setBusy(false); }
  }

  return <form className="form workspace-form" onSubmit={(event) => void save(event)}>
    <p>{row.book_name || "교재 미지정"} · 명단 #{row.id}</p>
    <label>담당 선생님<select value={teacherName} onChange={(event) => setTeacherName(event.target.value)}>{teachers.map((name) => <option key={name}>{name}</option>)}</select></label>
    <label>반<input value={className} onChange={(event) => setClassName(event.target.value)} required maxLength={120} /></label>
    <button className="primary" disabled={busy || !className.trim() || (teacherName === row.teacher_name && className.trim() === row.class_name)}>{busy ? "저장 중..." : "담당·반 저장"}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}

