"use client";

import { useState } from "react";
import { displayProblemNumbers } from "../lib/wrong-answers";

type RecordRow = { id?: number; unit?: string; problem?: string; memo?: string; created_at?: string };
type SchoolRow = { id: number; problem?: string; created_at?: string };
type View = "home" | "weekly" | "helper";

const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const days = ["일", "월", "화", "수", "목", "금", "토"];

export default function StudentLearningHub({ view, name, answers, schoolAnswers, onNavigate }: { view: View; name: string; answers: RecordRow[]; schoolAnswers: SchoolRow[]; onNavigate: (tab: "wrong" | "learn" | "questions" | "attendance") => void }) {
  const [topic, setTopic] = useState("");
  const now = new Date();
  const today = dayKey(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  const timeline = Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return { key: dayKey(date), label: `${date.getMonth() + 1}/${date.getDate()} (${days[date.getDay()]})` }; });
  const activity = [...answers.map((row) => ({ id: `wrong-${row.id}`, at: row.created_at || "", label: `${row.unit || "교재"} · ${displayProblemNumbers(row.unit || "", row.problem || "")}번`, kind: "오답" })), ...schoolAnswers.map((row) => ({ id: `school-${row.id}`, at: row.created_at || "", label: `학교 기출 · ${row.problem || "?"}번`, kind: "학교 기출" }))].sort((a, b) => b.at.localeCompare(a.at));
  const counts = new Map(timeline.map(({ key }) => [key, 0]));
  for (const row of activity) { const key = row.at ? dayKey(new Date(row.at)) : ""; if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1); }
  const weekTotal = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const todayTotal = counts.get(today) || 0;

  if (view === "home") return <div className="learning-hub">
    <section className="panel learning-hero"><span className="badge">오늘의 학습</span><h2>{name} 학생, 오늘은 무엇을 공부할까요?</h2><p>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "full" }).format(now)} · 최근 7일 동안 기록한 학습을 바탕으로 보여드립니다.</p><div className="learning-metrics"><article><b>{todayTotal}</b><span>오늘 기록</span></article><article><b>{weekTotal}</b><span>최근 7일 기록</span></article><article><b>{answers.length}</b><span>누적 오답</span></article></div></section>
    <section className="panel"><h2>바로 시작하기</h2><div className="learning-actions"><button type="button" onClick={() => onNavigate("wrong")}>✏️ 오답 작성</button><button type="button" onClick={() => onNavigate("learn")}>▶️ 문제별 해설</button><button type="button" onClick={() => onNavigate("questions")}>💬 선생님께 질문</button><button type="button" onClick={() => onNavigate("attendance")}>📍 출석 확인</button></div></section>
    <section className="panel"><h2>최근 학습 기록</h2>{activity.length ? activity.slice(0, 5).map((row) => <div className="row" key={row.id}><strong>{row.label}</strong><span>{row.kind} · {row.at ? new Date(row.at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "날짜 미상"}</span></div>) : <p>아직 기록이 없습니다. 첫 오답을 작성해 보세요.</p>}</section>
  </div>;

  if (view === "weekly") return <div className="learning-hub"><section className="panel"><span className="badge">주간 학습기록</span><h2>최근 7일의 공부 흔적</h2><p>오답 작성과 학교 기출 저장 기록을 날짜별로 집계합니다. 공부 시간이나 진도는 아직 자동 측정하지 않습니다.</p><div className="learning-metrics"><article><b>{weekTotal}</b><span>저장한 기록</span></article><article><b>{[...counts.values()].filter(Boolean).length}</b><span>기록한 날</span></article><article><b>{activity.filter((row) => row.at && counts.has(dayKey(new Date(row.at))) && row.kind === "학교 기출").length}</b><span>학교 기출 기록</span></article></div><div className="learning-week">{timeline.map(({ key, label }) => <div className="learning-day" key={key}><span>{label}</span><b>{counts.get(key) || 0}건</b><div className="learning-bar-track"><div style={{ width: `${Math.min(100, ((counts.get(key) || 0) / Math.max(1, ...counts.values())) * 100)}%` }} /></div></div>)}</div></section></div>;

  const guidance: Record<string, string[]> = {
    plan: ["이번 주 목표를 한 문장으로 정해 보세요.", "최근 오답 중 헷갈렸던 문제 2~3개를 먼저 다시 풀어 보세요.", "공부가 끝나면 오답과 궁금한 점을 바로 기록해 두세요."],
    review: ["정답을 가리고 처음부터 다시 풀어 보세요.", "틀린 이유를 계산·개념·문제 해석 중 하나로 적어 보세요.", "막히는 부분은 질문함에 남겨 선생님에게 확인하세요."],
    habit: ["매일 같은 시간에 짧게 시작해 보세요.", "오늘 한 일 한 가지와 내일 할 일 한 가지를 적어 보세요.", "일주일 기록을 보고 빈 날이 있으면 무리하지 않는 분량으로 다시 시작하세요."],
  };
  return <div className="learning-hub"><section className="panel"><span className="badge">결결이 · 학습 도우미 미리보기</span><h2>공부를 이어 가는 작은 도움</h2><p>현재는 AI 상담이 연결되지 않은 화면입니다. 아래는 미리 작성된 학습 팁이며, 질문을 입력해 AI 답변을 받는 기능은 추후 제공됩니다.</p><div className="learning-actions">{[["plan", "학습 계획"], ["review", "오답 복습"], ["habit", "공부 습관"]].map(([key, label]) => <button type="button" key={key} aria-pressed={topic === key} className={topic === key ? "selected" : ""} onClick={() => setTopic(key)}>{label}</button>)}</div>{topic && <div className="learning-guidance"><h3>{topic === "plan" ? "학습 계획" : topic === "review" ? "오답 복습" : "공부 습관"} 팁</h3><ol>{guidance[topic].map((line) => <li key={line}>{line}</li>)}</ol></div>}<p className="learning-note">개인정보나 비밀번호는 입력하지 마세요. 긴급한 고민은 보호자·선생님께 직접 이야기해 주세요.</p></section></div>;
}

