"use client";

import { FormEvent, useEffect, useState } from "react";

type Row = Record<string, any>;
type AdminData = { books: Row[]; exams: Row[]; notices: Row[] };

async function parse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "요청을 처리하지 못했습니다.");
  return body;
}

export default function AdminPanel({ roster, refreshRoster }: { roster: Row[]; refreshRoster: () => Promise<void> }) {
  const [data, setData] = useState<AdminData>({ books: [], exams: [], notices: [] });
  const [section, setSection] = useState<"roster" | "books" | "exams" | "notices">("roster");
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [rosterForm, setRosterForm] = useState({ teacher_name: "", class_name: "", school_name: "", grade: "", book_name: "" });
  const [bookName, setBookName] = useState("");
  const [bookSubject, setBookSubject] = useState("");
  const [examYear, setExamYear] = useState(String(new Date().getFullYear()));
  const [examSchool, setExamSchool] = useState("");
  const [examSubject, setExamSubject] = useState("");
  const [examType, setExamType] = useState("");
  const [examCount, setExamCount] = useState("");
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [noticeTarget, setNoticeTarget] = useState("all");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() { setData(await parse(await fetch("/api/admin/manage", { cache: "no-store" }))); }
  useEffect(() => { void reload().catch((error) => setMessage(error.message)); }, []);
  async function run(task: () => Promise<void>) { setBusy(true); setMessage(""); try { await task(); } catch (error) { setMessage(error instanceof Error ? error.message : "실패했습니다."); } finally { setBusy(false); } }
  async function create(input: Row, event: FormEvent) { event.preventDefault(); await run(async () => { await parse(await fetch("/api/admin/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) })); await reload(); setMessage("등록했습니다."); }); }
  async function update(input: Row) { await run(async () => { await parse(await fetch("/api/admin/manage", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) })); await reload(); await refreshRoster(); setMessage("변경했습니다."); }); }
  function selectRoster(id: string) { setSelectedRosterId(id); const row = roster.find((item) => String(item.id) === id); if (row) setRosterForm({ teacher_name: row.teacher_name || "", class_name: row.class_name || "", school_name: row.school_name || "", grade: row.grade || "", book_name: row.book_name || "" }); }

  return <section className="panel"><h2>전체 관리자 관리</h2><nav className="workspace-tabs" aria-label="관리 메뉴">{[["roster", "학생 정보"], ["books", "교재"], ["exams", "학교 기출"], ["notices", "공지사항"]].map(([value, label]) => <button key={value} className={section === value ? "active" : ""} onClick={() => { setSection(value as typeof section); setMessage(""); }}>{label}</button>)}</nav>
    {message && <p className="workspace-message" role="status">{message}</p>}
    {section === "roster" && <><h3>학생 명단 정보 수정</h3><div className="form workspace-form"><label>명단 행 선택<select value={selectedRosterId} onChange={(event) => selectRoster(event.target.value)}><option value="">선택해주세요</option>{roster.map((row) => <option key={row.id} value={row.id}>{row.student_name} · {row.class_name} · {row.teacher_name}</option>)}</select></label>{selectedRosterId && <>{Object.entries({ teacher_name: "담당 선생님", class_name: "반", school_name: "학교", grade: "학년", book_name: "교재(여러 개는 쉼표로 구분)" }).map(([field, label]) => <label key={field}>{label}<input value={rosterForm[field as keyof typeof rosterForm]} onChange={(event) => setRosterForm({ ...rosterForm, [field]: event.target.value })} /></label>)}<button className="primary" disabled={busy} onClick={() => void update({ type: "roster", id: Number(selectedRosterId), ...rosterForm })}>변경 저장</button></>}</div></>}
    {section === "books" && <><h3>교재 등록</h3><form className="form workspace-form" onSubmit={(event) => void create({ type: "book", bookName, subject: bookSubject }, event)}><label>교재명<input value={bookName} onChange={(event) => setBookName(event.target.value)} required /></label><label>과목<input value={bookSubject} onChange={(event) => setBookSubject(event.target.value)} /></label><button className="primary" disabled={busy}>교재 등록</button></form><h3>등록 교재</h3>{data.books.map((row) => <div className="row workspace-record" key={row.id}><div><strong>{row.book_name}</strong><span>{row.subject} · {row.is_active ? "사용 중" : "중지"}</span></div><div><button disabled={busy} onClick={() => void update({ type: "book", id: row.id, isActive: !row.is_active })}>{row.is_active ? "사용 중지" : "다시 사용"}</button></div></div>)}</>}
    {section === "exams" && <><h3>학교 기출 등록</h3><form className="form workspace-form" onSubmit={(event) => void create({ type: "exam", examYear, schoolName: examSchool, subject: examSubject, examType, questionCount: examCount }, event)}><label>연도<input type="number" value={examYear} onChange={(event) => setExamYear(event.target.value)} required /></label><label>학교<input value={examSchool} onChange={(event) => setExamSchool(event.target.value)} required /></label><label>과목<input value={examSubject} onChange={(event) => setExamSubject(event.target.value)} required /></label><label>시험구분<input value={examType} onChange={(event) => setExamType(event.target.value)} placeholder="예: 1학기 중간" required /></label><label>문항수<input type="number" value={examCount} onChange={(event) => setExamCount(event.target.value)} /></label><button className="primary" disabled={busy}>학교 기출 등록</button></form><h3>등록된 시험</h3>{data.exams.map((row) => <div className="row workspace-record" key={row.id}><div><strong>{row.display_name}</strong><span>{row.school_name} · {row.subject} · {row.is_active ? "사용 중" : "중지"}</span></div><div><button disabled={busy} onClick={() => void update({ type: "exam", id: row.id, isActive: !row.is_active })}>{row.is_active ? "사용 중지" : "다시 사용"}</button></div></div>)}</>}
    {section === "notices" && <><h3>공지 등록</h3><form className="form workspace-form" onSubmit={(event) => void create({ type: "notice", title: noticeTitle, content: noticeContent, target: noticeTarget, isActive: true }, event)}><label>제목<input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} required /></label><label>내용<textarea value={noticeContent} onChange={(event) => setNoticeContent(event.target.value)} required /></label><label>대상<select value={noticeTarget} onChange={(event) => setNoticeTarget(event.target.value)}><option value="all">전체</option><option value="student">학생</option><option value="teacher">선생님</option></select></label><button className="primary" disabled={busy}>공지 등록</button></form><h3>등록된 공지</h3>{data.notices.map((row) => <div className="row workspace-record" key={row.id}><div><strong>{row.title}</strong><span>{row.content} · {row.target} · {row.is_active ? "노출 중" : "숨김"}</span></div><div><button disabled={busy} onClick={() => void update({ type: "notice", id: row.id, isActive: !row.is_active })}>{row.is_active ? "숨기기" : "노출"}</button></div></div>)}</>}
  </section>;
}
