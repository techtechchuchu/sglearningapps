"use client";

import { FormEvent, useEffect, useState } from "react";
import { displayProblemNumbers, splitRosterBooks } from "../lib/wrong-answers";
import BrandLockup from "./brand-lockup";
import StudentProblemBrowser from "./student-problem-browser";
import StudentAttendance from "./student-attendance";
import StudentLearningHub from "./student-learning-hub";
import { LegacyKakaoLink } from "./member-account";
import { StudentQuestions } from "./learning-questions";
import { BOOK_PERIODS, BookPeriod, filterBooksByPeriod, finalBooksForRoster } from "../lib/book-periods";

type Row = Record<string, any>;
type Data = { roster: Row[]; wrongAnswers: Row[]; wrongNoteFiles: Row[]; notices: Row[]; mustChangePassword?: boolean; grade?: string };
type Exam = { id: number; school_name: string; display_name: string; exam_year: number; exam_type: string; question_count: number };
type SchoolAnswer = { id: number; exam_id: number; problem: string; memo: string; created_at: string };
type ExamOption = { id: string; label: string; max: number; requiresConfirmation: boolean };

async function json(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `서버 오류 (${response.status})`);
  return body;
}

export default function StudentWorkspace({ name, data, refresh, logout }: { name: string; data: Data; refresh: () => Promise<void>; logout: () => void }) {
  const [tab, setTab] = useState<"home" | "weekly" | "questions" | "helper" | "wrong" | "school" | "learn" | "attendance" | "records" | "account">(() => typeof window !== "undefined" && window.location.hash.startsWith("#attendance=") ? "attendance" : "home");
  const [books, setBooks] = useState<string[]>([]);
  const [examsByBook, setExamsByBook] = useState<Record<string, ExamOption[]>>({});
  const [schoolExams, setSchoolExams] = useState<Exam[]>([]);
  const [schoolAnswers, setSchoolAnswers] = useState<SchoolAnswer[]>([]);
  const [book, setBook] = useState("");
  const [bookPeriod, setBookPeriod] = useState<BookPeriod>("2학기 기말");
  const [examId, setExamId] = useState("");
  const [problem, setProblem] = useState("");
  const [memo, setMemo] = useState("");
  const [bookConfirmed, setBookConfirmed] = useState(false);
  const [examConfirmed, setExamConfirmed] = useState(false);
  const [requestVariant, setRequestVariant] = useState(false);
  const [schoolExamId, setSchoolExamId] = useState("");
  const [schoolProblem, setSchoolProblem] = useState("");
  const [schoolMemo, setSchoolMemo] = useState("");
  const [schoolConfirmed, setSchoolConfirmed] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordAgain, setNewPasswordAgain] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editMemo, setEditMemo] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function booksForPeriod(sourceBooks: string[], period: BookPeriod) {
    const periodBooks = filterBooksByPeriod(sourceBooks, period);
    return period === "2학기 기말" ? finalBooksForRoster(periodBooks, data.roster) : periodBooks;
  }

  useEffect(() => {
    void Promise.all([
      fetch("/api/student/books").then(json),
      fetch("/api/student/school-exams").then(json),
    ]).then(([bookData, examData]) => {
      setBooks(bookData.books || []);
      setExamsByBook(bookData.exams || {});
      const finalBooks = booksForPeriod(bookData.books || [], "2학기 기말");
      setBook((current) => current || finalBooks[0] || bookData.books?.[0] || "");
      setSchoolExams(examData.exams || []);
      setSchoolAnswers(examData.answers || []);
    }).catch((error) => setMessage(error.message));
  }, []);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try { await task(); } catch (error) { setMessage(error instanceof Error ? error.message : "요청을 처리하지 못했습니다."); }
    finally { setBusy(false); }
  }

  const bookExams = examsByBook[book] || [];
  const visibleBooks = booksForPeriod(books, bookPeriod);
  const chosenBookExam = bookExams.find((item) => item.id === examId);
  const chosenSchoolExam = schoolExams.find((item) => String(item.id) === schoolExamId);
  const assignedBooks = [...new Set(data.roster.flatMap((row) => splitRosterBooks(row.book_name)))];

  async function saveWrong(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const result = await json(await fetch("/api/student/wrong-answers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ book, examId, examConfirmed, problem, memo, bookConfirmed, requestVariant }) }));
      await refresh();
      setProblem(""); setMemo(""); setBookConfirmed(false); setExamConfirmed(false); setRequestVariant(false);
      setMessage(`저장 확인 완료: ${result.saved.join(", ")}${result.duplicate.length ? ` · 중복 제외: ${result.duplicate.join(", ")}` : ""}`);
    });
  }

  async function saveSchool(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const result = await json(await fetch("/api/student/school-exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ examId: schoolExamId, problem: schoolProblem, memo: schoolMemo, confirmed: schoolConfirmed }) }));
      const updated = await json(await fetch("/api/student/school-exams", { cache: "no-store" }));
      setSchoolAnswers(updated.answers || []);
      setSchoolProblem(""); setSchoolMemo(""); setSchoolConfirmed(false);
      setMessage(`학교 기출 ${result.saved.join(", ")}번 저장을 확인했습니다.`);
    });
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== newPasswordAgain) { setMessage("새 비밀번호 확인이 일치하지 않습니다."); return; }
    await run(async () => {
      const result = await json(await fetch("/api/auth/student/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) }));
      setCurrentPassword(""); setNewPassword(""); setNewPasswordAgain("");
      await refresh();
      setMessage(result.message);
    });
  }

  async function updateMemo(id: number) {
    await run(async () => {
      await json(await fetch("/api/student/wrong-answers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, memo: editMemo }) }));
      await refresh(); setEditId(null); setMessage("비고를 수정했습니다.");
    });
  }

  async function removeWrong(id: number) {
    if (!window.confirm("이 오답 기록을 삭제할까요?")) return;
    await run(async () => {
      await json(await fetch("/api/student/wrong-answers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }));
      await refresh(); setMessage("오답 기록을 삭제했습니다.");
    });
  }

  return <main className="shell dashboard-shell study-workspace">
    <section className="topbar student-topbar"><BrandLockup compact /><div><span className="badge">내 오답노트</span><h1>{name} 학생</h1><p>{data.grade || ""} · {data.roster.map((row) => row.class_name).filter(Boolean).join(", ")}</p></div><div className="student-topbar-actions"><button type="button" className={`student-ai-counselor${tab === "helper" ? " active" : ""}`} aria-current={tab === "helper" ? "page" : undefined} onClick={() => { setTab("helper"); setMessage(""); }}>✦ AI 상담사 결결이</button><button type="button" className="ghost" onClick={logout}>로그아웃</button></div></section>
    <nav className="workspace-tabs" aria-label="학생 메뉴">
      {[["home", "오늘의 학습"], ["weekly", "주간 학습기록"], ["questions", "질문함"], ["wrong", "오답 작성"], ["school", "학교 기출"], ["learn", "문제별 해설"], ["attendance", "출석 체크"], ["records", "내 기록"], ["account", "계정 관리"]].map(([value, label]) => <button key={value} className={tab === value ? "active" : ""} onClick={() => { setTab(value as typeof tab); setMessage(""); }}>{label}</button>)}
    </nav>
    {tab === "account" && !data.mustChangePassword && <LegacyKakaoLink />}
    {message && <p className="workspace-message" role="status">{message}</p>}
    {data.mustChangePassword && tab !== "account" ? <section className="panel"><h2>임시 비밀번호 변경 필요</h2><p>새 비밀번호를 설정한 뒤 오답노트를 이용할 수 있습니다.</p><button className="primary" onClick={() => setTab("account")}>비밀번호 변경하기</button></section> : null}
    {(tab === "home" || tab === "weekly" || tab === "helper") && !data.mustChangePassword && <StudentLearningHub view={tab} name={name} answers={data.wrongAnswers} schoolAnswers={schoolAnswers} onNavigate={setTab} />}
    {tab === "questions" && !data.mustChangePassword && <StudentQuestions classes={[...new Map(data.roster.filter((row) => row.enrollment_status !== "퇴원").map((row) => [`${row.teacher_name}\0${row.class_name}`, { teacherName: String(row.teacher_name || ""), className: String(row.class_name || "") }])).values()].filter((item) => item.teacherName && item.className)} />}
    {tab === "wrong" && !data.mustChangePassword && <section className="panel"><h2>오답 작성</h2><form onSubmit={saveWrong} className="form workspace-form">
      <fieldset className="book-period-picker"><legend>시험 시기 선택</legend><p>기말 교재는 현재 학년·반에 맞는 교재만 표시됩니다.</p><div role="group" aria-label="교재 시기 선택">{BOOK_PERIODS.map((period) => <button type="button" key={period} className={bookPeriod === period ? "active" : ""} aria-pressed={bookPeriod === period} onClick={() => { const nextBooks = booksForPeriod(books, period); setBookPeriod(period); setBook(nextBooks[0] || ""); setExamId(""); setBookConfirmed(false); setExamConfirmed(false); }}>{period}</button>)}</div></fieldset>
      <label>{bookPeriod === "전체 교재" ? "전체 교재" : `${bookPeriod} 교재`}<select value={book} onChange={(event) => { setBook(event.target.value); setExamId(""); setBookConfirmed(false); }} required><option value="">선택해주세요</option><optgroup label={bookPeriod}>{visibleBooks.map((item) => <option key={item}>{item}</option>)}</optgroup></select></label>
      {bookExams.length > 0 && <label>학교·시험<select value={examId} required onChange={(event) => { setExamId(event.target.value); setExamConfirmed(false); }}><option value="">선택해주세요</option>{bookExams.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>}
      {chosenBookExam && <p>{chosenBookExam.label} · 원래 시험지 번호 1~{chosenBookExam.max}번을 입력하세요.</p>}
      <label>문제번호<input value={problem} onChange={(event) => setProblem(event.target.value)} placeholder="예: 3, 7, 12" required /></label>
      <label>비고<textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="계산 실수, 개념 헷갈림 등" /></label>
      <label className="workspace-check"><input type="checkbox" checked={requestVariant} onChange={(event) => setRequestVariant(event.target.checked)} /> 변형문제 요청</label>
      <label className="workspace-check"><input type="checkbox" checked={bookConfirmed} onChange={(event) => setBookConfirmed(event.target.checked)} required /> {book} 교재가 맞습니다.</label>
      {chosenBookExam?.requiresConfirmation && <label className="workspace-check"><input type="checkbox" checked={examConfirmed} onChange={(event) => setExamConfirmed(event.target.checked)} required /> 시험 시기를 확인했습니다.</label>}
      <button className="primary" disabled={busy || !book}>저장하고 확인하기</button>
    </form></section>}
    {tab === "school" && !data.mustChangePassword && <section className="panel"><h2>학교 기출 오답</h2><form onSubmit={saveSchool} className="form workspace-form">
      <label>학교·시험<select value={schoolExamId} required onChange={(event) => setSchoolExamId(event.target.value)}><option value="">선택해주세요</option>{schoolExams.map((exam) => <option key={exam.id} value={exam.id}>{exam.display_name || `${exam.exam_year} ${exam.school_name} ${exam.exam_type}`}</option>)}</select></label>
      {chosenSchoolExam && <p>총 {chosenSchoolExam.question_count || "?"}문항</p>}
      <label>오답번호<input value={schoolProblem} onChange={(event) => setSchoolProblem(event.target.value)} placeholder="예: 3, 7, 12" required /></label>
      <label>비고<textarea value={schoolMemo} onChange={(event) => setSchoolMemo(event.target.value)} /></label>
      <label className="workspace-check"><input type="checkbox" checked={schoolConfirmed} onChange={(event) => setSchoolConfirmed(event.target.checked)} required /> 선택한 학교·시험이 맞습니다.</label>
      <button className="primary" disabled={busy}>학교 기출 저장하고 확인하기</button>
    </form><h3>내 학교 기출 기록</h3>{schoolAnswers.map((answer) => <div className="row" key={answer.id}><strong>{schoolExams.find((exam) => exam.id === answer.exam_id)?.display_name || `시험 ${answer.exam_id}`} · {answer.problem}번</strong><span>{answer.memo}</span></div>)}</section>}
    {tab === "records" && <><section className="metrics"><article><b>{data.wrongAnswers.length}</b><span>오답 기록</span></article><article><b>{schoolAnswers.length}</b><span>학교 기출</span></article><article><b>{assignedBooks.length}</b><span>명단 교재</span></article><article><b>{data.wrongNoteFiles.length}</b><span>PDF</span></article></section><section className="panel"><h2>내 수업·교재</h2>{data.roster.map((row, index) => <div className="row" key={row.id || index}><strong>{row.class_name || "반 미지정"}</strong><span>{row.teacher_name} · {splitRosterBooks(row.book_name).join(" · ") || "교재 미지정"}</span></div>)}</section><section className="panel"><h2>내 오답 목록</h2>{data.wrongAnswers.length ? data.wrongAnswers.map((row) => <div className="row workspace-record" key={row.id}><div><strong>{row.unit} · {displayProblemNumbers(row.unit, row.problem)}번</strong><span>{row.memo || ""} · {new Date(row.created_at).toLocaleString("ko-KR")}</span></div>{editId === row.id ? <div><textarea value={editMemo} onChange={(event) => setEditMemo(event.target.value)} /><button disabled={busy} onClick={() => void updateMemo(row.id)}>저장</button><button onClick={() => setEditId(null)}>취소</button></div> : <div><button onClick={() => { setEditId(row.id); setEditMemo(row.memo || ""); }}>비고 수정</button><button disabled={busy} onClick={() => void removeWrong(row.id)}>삭제</button></div>}</div>) : <p>저장된 오답이 없습니다.</p>}</section><section className="panel"><h2>오답노트 PDF 기록</h2>{data.wrongNoteFiles.map((row, index) => <div className="row" key={row.id || index}><strong>{row.original_filename || "오답노트"}</strong><span>{row.subject_name || ""} {row.round_number ? `· ${row.round_number}회` : ""} {row.id && <a href={`/api/files/wrong-note/${row.id}`} target="_blank" rel="noopener noreferrer">PDF 열기</a>}</span></div>)}</section></>}
    {tab === "account" && <section className="panel"><h2>비밀번호 변경</h2>{data.mustChangePassword && <p>임시 비밀번호로 로그인했습니다. 새 비밀번호를 설정해주세요.</p>}<form onSubmit={changePassword} className="form workspace-form"><label>현재 비밀번호<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label><label>새 비밀번호<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={4} required /></label><label>새 비밀번호 확인<input type="password" value={newPasswordAgain} onChange={(event) => setNewPasswordAgain(event.target.value)} minLength={4} required /></label><button className="primary" disabled={busy}>비밀번호 변경</button></form></section>}
    {tab === "attendance" && !data.mustChangePassword && <StudentAttendance classes={(() => {
      const classes = [...new Map(data.roster.filter((row) => row.enrollment_status !== "퇴원").map((row) => {
        const className = String(row.class_name || "").trim();
        const teacherName = String(row.teacher_name || "").trim();
        return [`${teacherName}\0${className}`, { className, teacherName }];
      }).filter(([key]) => !String(key).startsWith("\0") && !String(key).endsWith("\0")) as Array<[string, { className: string; teacherName: string }]>).values()];
      return classes.length ? classes : name === "추재현" ? [{ className: "출석 데모반", teacherName: "전체 관리자" }] : [];
    })()} />}
    {tab === "learn" && !data.mustChangePassword && <StudentProblemBrowser studentName={name} books={books} schoolExams={schoolExams} wrongAnswers={data.wrongAnswers} schoolAnswers={schoolAnswers} onWrite={(kind, selectedBook, selectedExam, number) => {
      if (kind === "xpattern") { setBook(selectedBook); setExamId(selectedExam); setProblem(String(number)); setBookConfirmed(false); setExamConfirmed(false); setTab("wrong"); }
      else { setSchoolExamId(selectedExam); setSchoolProblem(String(number)); setSchoolConfirmed(false); setTab("school"); }
      setMessage("선택한 문제번호를 입력했습니다. 내용을 확인하고 저장해주세요.");
    }} />}
  </main>;
}

