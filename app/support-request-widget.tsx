"use client";

import { FormEvent, useEffect, useState } from "react";

type SupportItem = { id: string; message: string; status: "open" | "replied"; admin_reply: string | null; created_at: string; replied_at: string | null };
const dateTime = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export default function SupportRequestWidget({ fixedFooter = false }: { fixedFooter?: boolean }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<SupportItem[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoading(true);
    void fetch("/api/support/requests?mine=1", { cache: "no-store" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message || "문의를 불러오지 못했습니다."); return data; })
      .then((data) => { if (live) setItems(data.requests || []); })
      .catch((error) => { if (live) setNotice(error instanceof Error ? error.message : "문의를 불러오지 못했습니다."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || message.trim().length < 10) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/support/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: message.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "문의를 접수하지 못했습니다.");
      setItems((previous) => [data.request, ...previous]);
      setMessage("");
      setNotice("문의가 접수되었습니다. 근무시간에 확인 후 답변드리겠습니다.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "문의를 접수하지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <>
    {fixedFooter ? <footer className="sg-contact-footer" aria-label="스터디결 이용 문의"><span>스터디결 이용 중 도움이 필요하신가요?</span><button type="button" className="sg-contact-ai-only" onClick={() => setOpen(true)}>관리자 상담 요청</button></footer> : <button type="button" className="support-request-trigger" onClick={() => setOpen(true)}>관리자 상담 요청</button>}
    {open && <div className="support-request-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="support-request-dialog" role="dialog" aria-modal="true" aria-labelledby="support-request-heading">
        <header><h2 id="support-request-heading">관리자 상담 요청</h2><button type="button" onClick={() => setOpen(false)} aria-label="닫기">×</button></header>
        <p>안녕하세요. 스터디결 관리자입니다. 문의사항을 남겨주시면 근무시간에 확인하는 대로 답변드리겠습니다.</p>
        <p className="support-request-hours">근무시간 · 평일 오전 10시~오후 5시</p>
        <form onSubmit={(event) => void submit(event)}><label htmlFor="support-request-message">문의 내용</label><textarea id="support-request-message" value={message} onChange={(event) => setMessage(event.target.value)} minLength={10} maxLength={2000} placeholder="어떤 점이 불편한지 적어주세요. 비밀번호나 인증번호는 입력하지 마세요." required /><button type="submit" disabled={busy || message.trim().length < 10}>{busy ? "접수 중…" : "문의 남기기"}</button></form>
        {notice && <p className="support-request-notice" role="status">{notice}</p>}
        <h3>내 문의 내역</h3>
        {loading ? <p>불러오는 중…</p> : items.length ? <div className="support-request-list">{items.map((item) => <article key={item.id}><small>{dateTime(item.created_at)} · {item.status === "replied" ? "답변 완료" : "답변 대기"}</small><p>{item.message}</p>{item.admin_reply && <div><strong>관리자 답변</strong><p>{item.admin_reply}</p></div>}</article>)}</div> : <p>아직 남긴 문의가 없습니다.</p>}
      </section>
    </div>}
  </>;
}
