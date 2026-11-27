"use client";

import { FormEvent, useEffect, useState } from "react";
import "./admin-operations.css";

type Notice = { id: number; title: string; content: string; target: "all" | "student" | "teacher"; priority: number; is_active: boolean; starts_at?: string | null; ends_at?: string | null };
type Draft = { title: string; content: string; target: Notice["target"]; priority: number; isActive: boolean; startsAt: string; endsAt: string };
const blank: Draft = { title: "", content: "", target: "student", priority: 100, isActive: false, startsAt: "", endsAt: "" };
const local = (value?: string | null) => value ? new Date(value).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16).replace(" ", "T") : "";
async function read(response: Response) { const value = await response.json(); if (!response.ok) throw new Error(value.message || "공지를 처리하지 못했습니다."); return value; }

export default function AdminNoticeManager() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function reload() { const data = await read(await fetch("/api/admin/manage", { cache: "no-store" })); setNotices(data.notices || []); }
  useEffect(() => { void reload().catch((error) => setMessage(error.message)); }, []);
  function edit(row: Notice) { setSelected(row.id); setDraft({ title: row.title, content: row.content, target: row.target, priority: row.priority, isActive: row.is_active, startsAt: local(row.starts_at), endsAt: local(row.ends_at) }); setMessage(""); }
  function set<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const payload = { type: "notice", ...(selected ? { id: selected } : {}), title: draft.title, content: draft.content, target: draft.target, priority: draft.priority, isActive: draft.isActive, startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : "", endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : "" };
      await read(await fetch("/api/admin/manage", { method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
      await reload(); setSelected(null); setDraft(blank); setMessage("공지를 저장했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "공지를 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }
  async function toggle(row: Notice) {
    setBusy(true); setMessage("");
    try { await read(await fetch("/api/admin/manage", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "notice", id: row.id, isActive: !row.is_active }) })); await reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "상태를 바꾸지 못했습니다."); }
    finally { setBusy(false); }
  }
  return <section className="panel admin-operations"><h2>📢 공지 관리</h2><p>학생 공지는 학생 홈 배너 맨 앞에 표시됩니다. 게시 기간은 한국시간 기준으로 입력하세요.</p>
    <form onSubmit={save}><div className="admin-operations-fields">
      <label>제목<input required maxLength={120} value={draft.title} onChange={(event) => set("title", event.target.value)} /></label>
      <label>대상<select value={draft.target} onChange={(event) => set("target", event.target.value as Draft["target"])}><option value="student">학생</option><option value="teacher">선생님</option><option value="all">전체</option></select></label>
      <label>내용<textarea required rows={4} value={draft.content} onChange={(event) => set("content", event.target.value)} /></label>
      <label>우선순위<input type="number" min={0} max={999} value={draft.priority} onChange={(event) => set("priority", Number(event.target.value))} /></label>
      <label>게시 시작<input type="datetime-local" value={draft.startsAt} onChange={(event) => set("startsAt", event.target.value)} /></label>
      <label>게시 종료<input type="datetime-local" value={draft.endsAt} onChange={(event) => set("endsAt", event.target.value)} /></label>
    </div><div className="admin-notice-actions"><label><input type="checkbox" checked={draft.isActive} onChange={(event) => set("isActive", event.target.checked)} /> 게시</label><button type="submit" className="primary" disabled={busy}>{selected ? "공지 수정" : "새 공지 저장"}</button>{selected && <button type="button" onClick={() => { setSelected(null); setDraft(blank); }}>취소</button>}</div></form>
    {message && <p role="status">{message}</p>}
    <div className="admin-notice-list">{notices.map((row) => <article key={row.id}><strong>{row.title}</strong><small>{row.target === "all" ? "전체" : row.target === "student" ? "학생" : "선생님"} · {row.is_active ? "게시 중" : "숨김"} · 우선순위 {row.priority}{row.starts_at ? ` · 시작 ${local(row.starts_at)}` : ""}{row.ends_at ? ` · 종료 ${local(row.ends_at)}` : ""}</small><p>{row.content}</p><button type="button" onClick={() => edit(row)}>편집</button><button type="button" disabled={busy} onClick={() => void toggle(row)}>{row.is_active ? "숨기기" : "게시"}</button></article>)}</div>
  </section>;
}
