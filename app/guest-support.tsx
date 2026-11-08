"use client";

import { FormEvent, useState } from "react";

const OPEN_CHAT = "https://open.kakao.com/o/sLgsIMFi";

export default function GuestSupport({ onClose, onReset }: { onClose: () => void; onReset: () => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [handoff, setHandoff] = useState(false);
  const [busy, setBusy] = useState(false);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (text.length < 2 || busy) return;
    setBusy(true);
    setAnswer("");
    setHandoff(false);
    try {
      const response = await fetch("/api/ai/gyeolgyeoli/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "안내를 불러오지 못했습니다.");
      setAnswer(result.answer || "");
      setHandoff(result.handoff === true);
    } catch {
      setAnswer("지금은 AI 안내를 불러오지 못했습니다. 상담원에게 문의해 주세요.");
      setHandoff(true);
    } finally {
      setBusy(false);
    }
  }

  return <div className="guest-support-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="guest-support-dialog" role="dialog" aria-modal="true" aria-labelledby="guest-support-title">
      <header><div><strong id="guest-support-title">AI 상담사 결결이</strong><p>로그인 전에는 비밀번호 재설정과 계정 이용만 안내합니다.</p></div><button type="button" onClick={onClose} aria-label="닫기">×</button></header>
      <form onSubmit={(event) => void ask(event)}>
        <label htmlFor="guest-support-question">무엇이 불편하신가요?</label>
        <input id="guest-support-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={300} placeholder="예: 비밀번호를 잊어버렸어요" autoFocus />
        <button type="submit" disabled={busy || question.trim().length < 2}>{busy ? "확인 중…" : "결결이에게 물어보기"}</button>
      </form>
      {answer && <div className="guest-support-answer" role="status"><p>{answer}</p>{!handoff && <button type="button" onClick={onReset}>학생 비밀번호 재설정 화면</button>}{handoff && <a href={OPEN_CHAT} target="_blank" rel="noopener noreferrer">상담원 연결 · 카카오톡 오픈채팅</a>}</div>}
      <div className="guest-support-actions"><button type="button" onClick={onReset}>비밀번호 재설정</button><a href={OPEN_CHAT} target="_blank" rel="noopener noreferrer">상담원 연결</a></div>
      <small>비밀번호, 인증번호, 주민등록번호는 입력하지 마세요. 대화 내용은 저장하지 않습니다.</small>
    </section>
  </div>;
}
