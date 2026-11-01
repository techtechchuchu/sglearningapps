"use client";

import { FormEvent, useEffect, useState } from "react";
import "./gyeolgyeoli.css";

type Turn = { role: "user" | "assistant"; text: string };
const suggestions = ["이번 주 공부 계획을 세워줘", "오답을 복습하는 방법을 알려줘", "시험 전날에는 무엇을 해야 해?"];

export default function GyeolgyeoliChat({ name }: { name: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    void fetch("/api/ai/gyeolgyeoli", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => { if (live) setEnabled(result.enabled === true); })
      .catch(() => { if (live) setEnabled(false); });
    return () => { live = false; };
  }, []);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy || !enabled) return;
    setBusy(true); setError(""); setQuestion("");
    const history = turns.slice(-6).map((turn) => ({ ...turn, text: turn.text.slice(0, 800) }));
    setTurns((previous) => [...previous, { role: "user", text }]);
    try {
      const response = await fetch("/api/ai/gyeolgyeoli", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, history }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "답변을 받지 못했습니다.");
      setTurns((previous) => [...previous, { role: "assistant", text: result.answer }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "답변을 받지 못했습니다.");
      setQuestion(text);
      setTurns((previous) => previous.slice(0, -1));
    } finally { setBusy(false); }
  }

  return <section className="gyeolgyeoli-chat" aria-label="AI 학습 도우미 결결이">
    <header className="gyeolgyeoli-chat-header"><span className="gyeolgyeoli-avatar" aria-hidden="true">결</span><div><strong>AI 학습 도우미 결결이</strong><small>{enabled === null ? "연결 확인 중" : enabled ? "공부에 관한 질문을 입력해 보세요" : "AI 연결을 준비 중입니다"}</small></div></header>
    <div className="gyeolgyeoli-chat-body"><div className="gyeolgyeoli-welcome"><span className="gyeolgyeoli-avatar" aria-hidden="true">결</span><div><h2>{name}님, 무엇이 궁금한가요?</h2><p>개념 설명부터 복습 계획까지 함께 정리해 드릴게요.</p></div></div>
      <div className="gyeolgyeoli-suggestions" aria-label="추천 질문">{suggestions.map((text) => <button type="button" key={text} disabled={!enabled || busy} onClick={() => setQuestion(text)}>{text}</button>)}</div>
      {turns.length > 0 && <div className="gyeolgyeoli-conversation" role="log" aria-live="polite">{turns.map((turn, index) => <div className={`gyeolgyeoli-message ${turn.role === "user" ? "student" : "assistant"}`} key={index}>{turn.role === "assistant" && <small>결결이</small>}<p>{turn.text}</p></div>)}</div>}
      {busy && <p className="gyeolgyeoli-status" role="status">결결이가 답변을 작성하고 있어요…</p>}
      {error && <p className="gyeolgyeoli-error" role="alert">{error}</p>}
    </div>
    <footer className="gyeolgyeoli-chat-footer"><form className="gyeolgyeoli-composer" onSubmit={(event) => void send(event)}><input aria-label="질문 입력" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={800} placeholder={enabled ? "공부에 관한 질문을 입력하세요" : "AI 연결을 준비 중입니다"} disabled={!enabled || busy} /><button type="submit" disabled={!enabled || busy || question.trim().length < 2} aria-label="질문 보내기">➤</button></form><p>입력한 내용은 AI 답변을 위해 Google Gemini로 전송됩니다. 개인정보·비밀번호는 입력하지 마세요. AI 답변은 틀릴 수 있습니다.</p></footer>
  </section>;
}

