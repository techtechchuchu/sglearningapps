"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { MockAnswers } from "../lib/university-mock-questions";

type Question = { id: string; topic: string; stem: string; choices: readonly string[] };
type Snapshot = {
  ready: boolean; message?: string; title: string; state?: "upcoming" | "open" | "closed";
  opensAt?: string; closesAt?: string; durationMinutes?: number; questionCount?: number;
  attempt?: { startedAt: string; deadlineAt: string; submittedAt: string | null; alias: string; answers?: MockAnswers } | null;
  questions?: Question[]; myScore?: number; myRank?: number | null; participantCount?: number;
  ranking?: { rank: number; alias: string; score: number; mine: boolean }[];
};

function MathText({ tex }: { tex: string }) {
  let html = "";
  try { html = katex.renderToString(tex, { throwOnError: true, trust: false, output: "htmlAndMathml" }); }
  catch { return <span>{tex}</span>; }
  return <span className="university-mock-math" dangerouslySetInnerHTML={{ __html: html }} />;
}

function dateTime(value?: string) {
  return value ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value)) : "";
}

function countdown(deadline?: string, clock = Date.now()) {
  const remaining = Math.max(0, Math.ceil((Date.parse(deadline || "") - clock) / 1000) || 0);
  return `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
}

export default function UniversityMockExam() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [answers, setAnswers] = useState<MockAnswers>({});
  const [clock, setClock] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const latestAnswers = useRef(answers);
  const saving = useRef(Promise.resolve());
  const finalizedDeadline = useRef("");
  latestAnswers.current = answers;

  const refresh = useCallback(async () => {
    const response = await fetch("/api/university/mock-exam", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "모의고사 정보를 불러오지 못했습니다.");
    setSnapshot(data);
    setAnswers(data.attempt?.answers || {});
  }, []);

  useEffect(() => { void refresh().catch((caught) => setError(caught.message)); }, [refresh]);
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const attempt = snapshot?.attempt;
    if (!attempt || attempt.submittedAt || !attempt.deadlineAt || clock < Date.parse(attempt.deadlineAt) || finalizedDeadline.current === attempt.deadlineAt) return;
    finalizedDeadline.current = attempt.deadlineAt;
    void refresh().catch((caught) => setError(caught.message));
  }, [clock, snapshot, refresh]);

  async function action(kind: "start" | "submit", bodyAnswers?: MockAnswers) {
    setBusy(true); setError("");
    try {
      if (kind === "submit") await saving.current;
      const response = await fetch("/api/university/mock-exam", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: kind, answers: bodyAnswers }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "요청을 처리하지 못했습니다.");
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "요청을 처리하지 못했습니다."); }
    finally { setBusy(false); }
  }

  function choose(questionId: string, choice: number) {
    const next = { ...latestAnswers.current, [questionId]: choice };
    setAnswers(next);
    // Keep a server-side draft so an interrupted session can be resumed.
    saving.current = saving.current.then(async () => {
      const response = await fetch("/api/university/mock-exam", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", answers: next }) });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "답안을 저장하지 못했습니다.");
      }
    }).catch((caught) => { setError(caught.message); });
  }

  if (!snapshot) return <section className="panel university-mock" role="status">{error || "모의고사 정보를 불러오는 중입니다."}</section>;
  const attempt = snapshot.attempt;
  const running = snapshot.state === "open" && attempt && !attempt.submittedAt;
  const expired = running && clock >= Date.parse(attempt.deadlineAt);
  const completed = snapshot.state === "closed" && attempt?.submittedAt;
  const answered = Object.keys(answers).length;

  return <section className="panel university-mock">
    <div className="university-mock-hero"><span className="badge">대학생 공식 모의고사 · PILOT</span><h2>{snapshot.title}</h2><p>모두 같은 문제를 풀고, 응시 기간이 끝난 뒤 익명 순위를 확인합니다.</p></div>
    {error && <p className="workspace-message" role="alert">{error}</p>}
    {!snapshot.ready ? <p>{snapshot.message || "모의고사를 준비 중입니다."}</p> : <>
      <div className="university-mock-meta"><span>응시 기간 <strong>{dateTime(snapshot.opensAt)} ~ {dateTime(snapshot.closesAt)}</strong></span><span>제한 시간 <strong>{snapshot.durationMinutes}분</strong></span><span>문항 <strong>{snapshot.questionCount}개 · 객관식</strong></span></div>
      {snapshot.state === "upcoming" && <p className="university-mock-notice">응시 기간이 시작되면 이곳에서 참여할 수 있습니다.</p>}
      {snapshot.state === "open" && !attempt && <div className="university-mock-notice"><p>시작하면 타이머가 바로 진행됩니다. 창을 닫아도 시간이 멈추지 않고 재응시는 불가능합니다.</p><button type="button" className="primary" disabled={busy} onClick={() => void action("start")}>30분 모의고사 시작하기</button></div>}
      {running && <>
        <div className="university-mock-progress" role="status"><strong>답안 {answered}/{snapshot.questionCount}</strong><span>남은 시간 <b>{countdown(attempt.deadlineAt, clock)}</b></span></div>
        {expired ? <div className="university-mock-notice"><p>제한 시간이 종료됐습니다. 저장된 답안으로 자동 제출됩니다.</p><button type="button" className="ghost" onClick={() => void refresh()}>제출 상태 확인</button></div> : <>
          <ol className="university-mock-questions">{(snapshot.questions || []).map((question, index) => <li key={question.id}><span className="university-eyebrow">{question.topic} · {index + 1}번</span><div className="university-mock-stem"><MathText tex={question.stem} /></div><fieldset><legend className="sr-only">{index + 1}번 답안</legend>{question.choices.map((choice, choiceIndex) => <label key={choiceIndex} className={answers[question.id] === choiceIndex ? "selected" : ""}><input type="radio" name={question.id} value={choiceIndex} checked={answers[question.id] === choiceIndex} onChange={() => choose(question.id, choiceIndex)} /><MathText tex={choice} /></label>)}</fieldset></li>)}</ol>
          <div className="university-mock-submit"><p>미응답 문항도 제출할 수 있습니다. 제출 후에는 답을 바꿀 수 없고, 정답·점수·순위는 전체 응시 기간이 끝난 뒤 공개됩니다.</p><button type="button" className="primary" disabled={busy} onClick={() => { if (window.confirm(`${snapshot.questionCount}문항 중 ${answered}문항에 답했습니다. 최종 제출하시겠습니까?`)) void action("submit", latestAnswers.current); }}>최종 제출하기</button></div>
        </>}
      </>}
      {attempt?.submittedAt && snapshot.state === "open" && <div className="university-mock-notice"><h3>제출 완료</h3><p>{dateTime(attempt.submittedAt)}에 답안을 제출했습니다. 결과와 익명 순위는 응시 기간 종료 후 열립니다.</p></div>}
      {snapshot.state === "closed" && !attempt && <p className="university-mock-notice">이번 모의고사 응시 기간이 종료됐습니다. 참여한 학생에게만 결과가 공개됩니다.</p>}
      {completed && <div className="university-mock-results"><div className="university-mock-score"><span>내 점수</span><strong>{snapshot.myScore}점</strong><span>내 순위 {snapshot.myRank ?? "집계 밖"}위 / {snapshot.participantCount}명</span></div><div><h3>상위 20명 · 익명 순위</h3><ol>{(snapshot.ranking || []).map((item) => <li key={`${item.rank}-${item.alias}`} className={item.mine ? "mine" : ""}><span>{item.rank}위 · {item.alias}{item.mine ? " (나)" : ""}</span><strong>{item.score}점</strong></li>)}</ol></div></div>}
    </>}
  </section>;
}
