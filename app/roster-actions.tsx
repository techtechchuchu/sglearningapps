"use client";

import { FormEvent, useState } from "react";
import { splitRosterBooks } from "../lib/wrong-answers";

type Row = Record<string, any>;
const teachers = ["이주백.T", "박병민.T", "노대근.T"];

export default function RosterActions({ mode, teacher, roster, activeBooks, refresh }: {
  mode: "register" | "exited"; teacher: string; roster: Row[]; activeBooks: string[]; refresh: () => Promise<void>;
}) {
  const admin = teacher === "전체 관리자";
  const [selectedTeacher, setSelectedTeacher] = useState(admin ? teachers[0] : teacher);
  const [studentName, setStudentName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [grade, setGrade] = useState("고1");
  const [className, setClassName] = useState("");
  const [books, setBooks] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const visibleRoster = admin ? roster : roster.filter((row) => row.teacher_name === teacher);
  const active = visibleRoster.filter((row) => row.enrollment_status !== "퇴원");
  const exited = visibleRoster.filter((row) => row.enrollment_status === "퇴원");
  const source = exited.find((row) => row.id === selectedId);
  const classes = [...new Set(roster.filter((row) => row.teacher_name === selectedTeacher).map((row) => String(row.class_name || "").trim()).filter(Boolean))].sort();

  async function send(input: Record<string, unknown>, method = "POST") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/staff/roster", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "처리하지 못했습니다.");
      await refresh();
      setMessage(result.message || "저장 결과를 확인했습니다.");
      setConfirmed(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "처리하지 못했습니다.");
    } finally { setBusy(false); }
  }

  function toggleBook(book: string, checked: boolean) {
    setBooks((current) => checked ? [...current, book] : current.filter((value) => value !== book));
  }

  async function register(event: FormEvent) {
    event.preventDefault();
    if (!confirmed) return setMessage("등록 확인에 체크해주세요.");
    await send({ action: "register", teacherName: selectedTeacher, studentName, schoolName, grade, className, books });
  }

  async function reenter(event: FormEvent) {
    event.preventDefault();
    if (!source || !confirmed) return setMessage("퇴원생과 재등록 확인을 선택해주세요.");
    await send({ action: "reenter", sourceId: source.id, teacherName: selectedTeacher, className: className || source.class_name, schoolName: schoolName || source.school_name, grade: grade || source.grade, books: books.length ? books : splitRosterBooks(source.book_name) });
  }

  if (mode === "register") return <section className="panel"><h2>➕ 신규생 등록</h2><p>학생 계정은 별도 회원가입이 필요합니다. 동명이인은 학교·학년·반을 함께 확인해주세요.</p>
    <form className="form workspace-form" onSubmit={(event) => void register(event)}>
      {admin && <label>담당 선생님<select value={selectedTeacher} onChange={(event) => setSelectedTeacher(event.target.value)}>{teachers.map((name) => <option key={name}>{name}</option>)}</select></label>}
      <label>학생 이름<input value={studentName} onChange={(event) => setStudentName(event.target.value)} required /></label>
      {studentName && visibleRoster.filter((row) => row.student_name === studentName).map((row) => <p key={row.id}>동일 이름 이력: {row.school_name || "학교 미지정"} · {row.grade} · {row.class_name} · {row.teacher_name}</p>)}
      <label>학교<input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} /></label>
      <label>학년<select value={grade} onChange={(event) => setGrade(event.target.value)}>{["중1", "중2", "중3", "고1", "고2", "고3", "N수"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>반<input list="teacher-classes" value={className} onChange={(event) => setClassName(event.target.value)} required /><datalist id="teacher-classes">{classes.map((value) => <option key={value} value={value} />)}</datalist></label>
      <fieldset><legend>사용 교재</legend>{activeBooks.map((book) => <label className="workspace-check" key={book}><input type="checkbox" checked={books.includes(book)} onChange={(event) => toggleBook(book, event.target.checked)} /> {book}</label>)}</fieldset>
      <label className="workspace-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> 위 정보를 확인했고 신규 재원생으로 등록합니다.</label>
      <button className="primary" disabled={busy || !confirmed || !books.length}>신규생 등록</button>
    </form>{message && <p role="status">{message}</p>}</section>;

  return <section className="panel"><h2>🚪 퇴원생 관리</h2><p>퇴원해도 기존 오답은 삭제되지 않습니다. 재등록은 새 명단 이력으로 추가됩니다.</p>
    <div className="metrics"><article><b>{new Set(active.map((row) => row.student_name)).size}</b><span>재원생</span></article><article><b>{new Set(exited.map((row) => row.student_name)).size}</b><span>퇴원생</span></article></div>
    <h3>퇴원 처리</h3>{active.map((row) => <div className="row workspace-record" key={row.id}><div><strong>{row.student_name} · {row.school_name || "-"} · {row.grade}</strong><span>{row.class_name} · {row.teacher_name}</span></div><button disabled={busy} onClick={() => { const reason = window.prompt(`${row.student_name} 학생을 퇴원 처리합니다. 메모를 입력하세요 (선택).`); if (reason !== null && window.confirm("퇴원 처리해도 기존 오답은 유지됩니다. 진행할까요?")) void send({ action: "exit", id: row.id, note: reason }, "PATCH"); }}>퇴원 처리</button></div>)}
    <h3>재등록</h3><form className="form workspace-form" onSubmit={(event) => void reenter(event)}>
      <label>퇴원생<select value={selectedId} onChange={(event) => { const row = exited.find((item) => item.id === Number(event.target.value)); setSelectedId(Number(event.target.value)); setBooks(row ? splitRosterBooks(row.book_name).filter((book) => activeBooks.includes(book)) : []); setClassName(String(row?.class_name || "")); setSchoolName(String(row?.school_name || "")); setGrade(String(row?.grade || "고1")); if (admin) setSelectedTeacher(String(row?.teacher_name || teachers[0])); }} required><option value={0}>선택해주세요</option>{exited.map((row) => <option key={row.id} value={row.id}>{row.student_name} · {row.school_name || "-"} · {row.grade} · 이전 {row.class_name}</option>)}</select></label>
      {admin && <label>새 담당 선생님<select value={selectedTeacher} onChange={(event) => setSelectedTeacher(event.target.value)}>{teachers.map((name) => <option key={name}>{name}</option>)}</select></label>}
      <label>새 반<input value={className} placeholder={source?.class_name || "반 이름"} onChange={(event) => setClassName(event.target.value)} /></label>
      <label>학교<input value={schoolName} placeholder={source?.school_name || "학교"} onChange={(event) => setSchoolName(event.target.value)} /></label>
      <label>학년<select value={grade} onChange={(event) => setGrade(event.target.value)}>{["중1", "중2", "중3", "고1", "고2", "고3", "N수"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <fieldset><legend>교재 (선택하지 않으면 이전 교재 사용)</legend>{activeBooks.map((book) => <label className="workspace-check" key={book}><input type="checkbox" checked={books.includes(book)} onChange={(event) => toggleBook(book, event.target.checked)} /> {book}</label>)}</fieldset>
      <label className="workspace-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> 이전 이력을 유지하고 새 재원 기록을 만듭니다.</label>
      <button className="primary" disabled={busy || !source || !confirmed}>재등록</button>
    </form>{message && <p role="status">{message}</p>}
    <h3>퇴원생 목록</h3>{exited.map((row) => <div className="row" key={row.id}><strong>{row.student_name} · {row.class_name} · {row.teacher_name}</strong><span>{row.exited_at ? new Date(row.exited_at).toLocaleString("ko-KR") : "퇴원일 미지정"} · {row.status_note || ""}</span></div>)}
  </section>;
}
