"use client";

import { FormEvent, useEffect, useState } from "react";

type Question = { id: number; student_name: string; teacher_name: string; class_name: string; question: string; problem_ref: string | null; answer: string | null; status: "open" | "answered" | "resolved"; created_at: string };
type ClassOption = { teacherName: string; className: string };

async function read(response: Response) { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "요청을 완료하지 못했습니다."); return data; }

export function StudentQuestions({ classes }: { classes: ClassOption[] }) {
  const [items, setItems] = useState<Question[]>([]);
  const [target, setTarget] = useState("");
  const [problemRef, setProblemRef] = useState("");
  const [question, setQuestion] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() { const data = await read(await fetch("/api/questions", { cache: "no-store" })); setItems(data.questions || []); }
  useEffect(() => { void load().catch((error) => setMessage(error.message)); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); const choice = classes[Number(target)]; if (!choice) { setMessage("담당 반을 선택해주세요."); return; }
    setBusy(true); setMessage("");
    try { await read(await fetch("/api/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...choice, problemRef, question }) })); setQuestion(""); setProblemRef(""); await load(); setMessage("질문을 선생님께 보냈습니다."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "질문 전송에 실패했습니다."); }
    finally { setBusy(false); }
  }
  async function resolve(id: number) {
    setBusy(true); setMessage("");
    try { await read(await fetch("/api/questions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "resolve" }) })); await load(); setMessage("해결 완료로 표시했습니다."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "저장하지 못했습니다."); }
    finally { setBusy(false); }
  }
  return <div className="learning-hub"><section className="panel"><h2>💬 선생님께 질문하기</h2><p>문제번호와 막힌 부분을 적어 보내면 담당 선생님이 확인하고 답변할 수 있습니다.</p>{message && <p className="workspace-message" role="status">{message}</p>}{classes.length ? <form className="form workspace-form" onSubmit={submit}><label>담당 반<select value={target} onChange={(event) => setTarget(event.target.value)} required><option value="">선택해주세요</option>{classes.map((item, index) => <option value={index} key={`${item.teacherName}-${item.className}`}>{item.className} · {item.teacherName}</option>)}</select></label><label>교재·문제번호 (선택)<input maxLength={120} value={problemRef} onChange={(event) => setProblemRef(event.target.value)} placeholder="예: X-패턴 12번" /></label><label>질문<textarea minLength={5} maxLength={2000} required value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="어디까지 풀었고 어느 부분이 어려운지 적어주세요." /></label><button className="primary" disabled={busy}>질문 보내기</button></form> : <p>담당 반이 확인되지 않아 질문을 보낼 수 없습니다.</p>}</section><section className="panel"><h2>내 질문과 답변</h2>{items.length ? items.map((item) => <article className="question-card" key={item.id}><div className="question-card-head"><strong>{item.problem_ref || "일반 학습 질문"}</strong><span>{item.status === "resolved" ? "해결 완료" : item.status === "answered" ? "답변 도착" : "답변 대기"}</span></div><small>{item.class_name} · {item.teacher_name} · {new Date(item.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</small><p>{item.question}</p>{item.answer && <div className="question-answer"><strong>선생님 답변</strong><p>{item.answer}</p></div>}{item.status === "answered" && <button type="button" disabled={busy} onClick={() => void resolve(item.id)}>해결 완료 표시</button>}</article>) : <p>아직 남긴 질문이 없습니다.</p>}</section></div>;
}

export function TeacherQuestions({ roster, users }: { roster: Record<string, any>[]; users: Record<string, any>[] }) {
  const [items, setItems] = useState<Question[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() { const data = await read(await fetch("/api/questions", { cache: "no-store" })); setItems(data.questions || []); }
  useEffect(() => { void load().catch((error) => setMessage(error.message)); }, []);
  async function answer(id: number) {
    setBusy(true); setMessage("");
    try { await read(await fetch("/api/questions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, answer: drafts[id] || "" }) })); await load(); setMessage("답변을 저장했습니다."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "답변을 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }
  return <section className="panel learning-hub"><h2>💬 학생 질문함</h2><p>담당 학생이 보낸 학습 질문에 답변할 수 있습니다. 질문 카드에서 학생 정보를 바로 확인할 수 있습니다.</p>{message && <p className="workspace-message" role="status">{message}</p>}{items.length ? items.map((item) => {
    const studentRows = roster.filter((row) => row.student_name === item.student_name && row.enrollment_status !== "퇴원");
    const studentUser = users.find((row) => row.username === item.student_name);
    const expanded = expandedStudent === `${item.id}:${item.student_name}`;
    return <article className="question-card" key={item.id}><div className="question-card-head"><strong>{item.student_name} · {item.class_name}</strong><span>{item.status === "resolved" ? "해결 완료" : item.status === "answered" ? "답변 완료" : "답변 대기"}</span></div><div className="question-card-actions"><small>{item.problem_ref || "일반 학습 질문"} · {new Date(item.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</small><button type="button" onClick={() => setExpandedStudent(expanded ? null : `${item.id}:${item.student_name}`)} aria-expanded={expanded}>학생 정보 {expanded ? "접기" : "보기"}</button></div>{expanded && <div className="question-student-info"><strong>{item.student_name} · {studentUser ? "가입 완료" : "계정 미확인"}</strong>{studentRows.length ? <ul>{studentRows.map((row) => <li key={row.id}>{row.school_name || "학교 미지정"} · {row.grade || "학년 미지정"} · {row.teacher_name} · {row.class_name} · {row.book_name || "교재 미지정"}</li>)}</ul> : <p>현재 활성 학생 명단에서 배정 정보를 찾지 못했습니다.</p>}</div>}<p>{item.question}</p>{item.answer && <div className="question-answer"><strong>기존 답변</strong><p>{item.answer}</p></div>}<label>답변<textarea value={drafts[item.id] ?? item.answer ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={4000} /></label><button type="button" className="primary" disabled={busy} onClick={() => void answer(item.id)}>답변 저장</button></article>;
  }) : <p>도착한 질문이 없습니다.</p>}</section>;
}

