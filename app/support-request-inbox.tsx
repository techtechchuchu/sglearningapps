"use client";

import { FormEvent, useEffect, useState } from "react";

type SupportItem = { id: string; requester_role: string; requester_name: string; message: string; status: "open" | "replied"; admin_reply: string | null; created_at: string; replied_at: string | null };
const dateTime = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export default function SupportRequestInbox() {
  const [items, setItems] = useState<SupportItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");

  async function reload() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/support/requests", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "문의 목록을 불러오지 못했습니다.");
      setItems(data.requests || []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "문의 목록을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void reload(); }, []);

  async function reply(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const text = (drafts[id] || "").trim();
    if (text.length < 2 || busyId) return;
    setBusyId(id); setError("");
    try {
      const response = await fetch("/api/support/requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, reply: text }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "답변을 저장하지 못했습니다.");
      setItems((previous) => previous.map((item) => item.id === id ? data.request : item));
      setDrafts((previous) => ({ ...previous, [id]: "" }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "답변을 저장하지 못했습니다."); }
    finally { setBusyId(""); }
  }

  const pending = items.filter((item) => item.status === "open");
  const ordered = [...pending, ...items.filter((item) => item.status !== "open")];
  return <section className="panel support-inbox" aria-label="관리자 상담 요청">
    <div className="support-inbox-heading"><div><h2>관리자 상담 요청 · 답변 대기 {pending.length}건</h2><p>로그인한 이용자가 앱에서 남긴 문의입니다. 답변은 이용자 화면의 내 문의 내역에 표시됩니다.</p></div><button type="button" className="ghost" onClick={() => void reload()} disabled={loading}>{loading ? "확인 중…" : "새로고침"}</button></div>
    {error && <p className="alert" role="alert">{error}</p>}
    {!loading && !items.length && <p>접수된 문의가 없습니다.</p>}
    <div className="support-inbox-list">{ordered.map((item) => <article key={item.id}><small>{item.status === "open" ? "답변 대기" : "답변 완료"} · {dateTime(item.created_at)} · {item.requester_name} ({item.requester_role})</small><p>{item.message}</p>{item.admin_reply && <div className="support-inbox-previous"><strong>이전 답변</strong><p>{item.admin_reply}</p></div>}<form onSubmit={(event) => void reply(event, item.id)}><label htmlFor={`support-reply-${item.id}`}>{item.admin_reply ? "답변 수정" : "관리자 답변"}</label><textarea id={`support-reply-${item.id}`} value={drafts[item.id] || ""} onChange={(event) => setDrafts((previous) => ({ ...previous, [item.id]: event.target.value }))} minLength={2} maxLength={2000} required /><button type="submit" className="primary" disabled={busyId !== "" || (drafts[item.id] || "").trim().length < 2}>{busyId === item.id ? "저장 중…" : "답변 저장"}</button></form></article>)}</div>
  </section>;
}
