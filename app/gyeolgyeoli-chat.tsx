"use client";

import { FormEvent, Fragment, useEffect, useState } from "react";
import "./gyeolgyeoli.css";

type Turn = { role: "user" | "assistant"; text: string; createdAt: string };
type SavedMessage = { question: string; answer: string; created_at: string };
const toTurns = (messages: SavedMessage[]): Turn[] => messages.flatMap((message) => [{ role: "user", text: message.question, createdAt: message.created_at }, { role: "assistant", text: message.answer, createdAt: message.created_at }]);
const dateKey = (createdAt: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(createdAt));
const dateLabel = (createdAt: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date(createdAt));
const suggestions = ["이번 주 공부 계획을 세워줘", "오답을 복습하는 방법을 알려줘", "시험 전날에는 무엇을 해야 해?"];

export default function GyeolgyeoliChat({ name }: { name: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [savingWarning, setSavingWarning] = useState(false);

  useEffect(() => {
    let live = true;
    void fetch("/api/ai/gyeolgyeoli", { cache: "no-store" })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.message || "대화 기록을 불러오지 못했습니다."); return result; })
      .then((result) => { if (live) { setEnabled(result.enabled === true); setTurns(toTurns(result.messages || [])); setCursor(result.nextCursor || null); } })
      .catch((caught) => { if (live) { setEnabled(false); setError(caught instanceof Error ? caught.message : "대화 기록을 불러오지 못했습니다."); } });
    return () => { live = false; };
  }, []);

  async function loadOlder() {
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true); setError("");
    try {
      const response = await fetch(`/api/ai/gyeolgyeoli?before=${encodeURIComponent(cursor)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "이전 대화를 불러오지 못했습니다.");
      setTurns((previous) => [...toTurns(result.messages || []), ...previous]);
      setCursor(result.nextCursor || null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "이전 대화를 불러오지 못했습니다."); }
    finally { setLoadingOlder(false); }
  }

  async function clearHistory() {
    if (busy || !window.confirm("저장된 결결이 대화를 모두 삭제할까요? 삭제한 대화는 복구할 수 없습니다.")) return;
    setError("");
    try {
      const response = await fetch("/api/ai/gyeolgyeoli", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "대화 기록을 삭제하지 못했습니다.");
      setTurns([]); setCursor(null); setSavingWarning(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "대화 기록을 삭제하지 못했습니다."); }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy || !enabled) return;
    setBusy(true); setError(""); setSavingWarning(false); setQuestion("");
    setTurns((previous) => [...previous, { role: "user", text, createdAt: new Date().toISOString() }]);
    try {
      const response = await fetch("/api/ai/gyeolgyeoli", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "답변을 받지 못했습니다.");
      const createdAt = typeof result.createdAt === "string" ? result.createdAt : new Date().toISOString();
      setTurns((previous) => [...previous.slice(0, -1), { role: "user", text, createdAt }, { role: "assistant", text: result.answer, createdAt }]);
      setSavingWarning(result.saved === false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "답변을 받지 못했습니다.");
      setQuestion(text);
      setTurns((previous) => previous.slice(0, -1));
    } finally { setBusy(false); }
  }

  return <section className="gyeolgyeoli-chat" aria-label="AI 학습 도우미 결결이">
    <header className="gyeolgyeoli-chat-header"><span className="gyeolgyeoli-avatar" aria-hidden="true">결</span><div><strong>AI 학습 도우미 결결이</strong><small>{enabled === null ? "연결 확인 중" : enabled ? "공부에 관한 질문을 입력해 보세요" : "AI 연결을 준비 중입니다"}</small></div>{turns.length > 0 && <button type="button" className="gyeolgyeoli-clear" onClick={() => void clearHistory()}>대화 삭제</button>}</header>
    <div className="gyeolgyeoli-chat-body"><div className="gyeolgyeoli-welcome"><span className="gyeolgyeoli-avatar" aria-hidden="true">결</span><div><h2>{name}님, 무엇이 궁금한가요?</h2><p>개념 설명부터 복습 계획까지 함께 정리해 드릴게요.</p></div></div>
      <div className="gyeolgyeoli-suggestions" aria-label="추천 질문">{suggestions.map((text) => <button type="button" key={text} disabled={!enabled || busy} onClick={() => setQuestion(text)}>{text}</button>)}</div>
      {cursor && <button type="button" className="gyeolgyeoli-older" disabled={loadingOlder} onClick={() => void loadOlder()}>{loadingOlder ? "불러오는 중…" : "이전 대화 보기"}</button>}
      {turns.length > 0 && <div className="gyeolgyeoli-conversation" role="log" aria-live="polite">{turns.map((turn, index) => <Fragment key={`${turn.createdAt}-${index}`}>{(index === 0 || dateKey(turn.createdAt) !== dateKey(turns[index - 1].createdAt)) && <div className="gyeolgyeoli-date-divider"><time dateTime={dateKey(turn.createdAt)}>{dateLabel(turn.createdAt)}</time></div>}<div className={`gyeolgyeoli-message ${turn.role === "user" ? "student" : "assistant"}`}>{turn.role === "assistant" && <small>결결이</small>}<p>{turn.text}</p></div></Fragment>)}</div>}
      {busy && <p className="gyeolgyeoli-status" role="status">결결이가 답변을 작성하고 있어요…</p>}
      {savingWarning && <p className="gyeolgyeoli-error" role="alert">답변은 받았지만 기록은 저장되지 않았습니다. 관리자에게 알려주세요.</p>}
      {error && <p className="gyeolgyeoli-error" role="alert">{error}</p>}
    </div>
    <footer className="gyeolgyeoli-chat-footer"><form className="gyeolgyeoli-composer" onSubmit={(event) => void send(event)}><input aria-label="질문 입력" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={800} placeholder={enabled ? "공부에 관한 질문을 입력하세요" : "AI 연결을 준비 중입니다"} disabled={!enabled || busy} /><button type="submit" disabled={!enabled || busy || question.trim().length < 2} aria-label="질문 보내기">➤</button></form><p>대화는 로그인한 계정에 저장되며 AI 답변을 위해 Google Gemini로 전송됩니다. 개인정보·비밀번호는 입력하지 마세요. AI 답변은 틀릴 수 있습니다.</p></footer>
  </section>;
}
