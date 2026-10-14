"use client";

import { FormEvent, useMemo, useState } from "react";
import { displayProblemNumbers, parseProblemNumbers, splitRosterBooks } from "../lib/wrong-answers";
import AdminPanel from "./admin-panel";

type Row = Record<string, any>;
export type TeacherData = { roster: Row[]; wrongAnswers: Row[]; wrongNoteFiles: Row[]; reports: Row[]; printStatus: Row[]; schoolWrongAnswers: Row[]; schoolExams: Row[]; resetRequests: Row[]; users: Row[] };

async function readJson(response: Response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `요청 실패 (${response.status})`);
  return result;
}

export default function TeacherWorkspace({ teacher, data, refresh, logout }: { teacher: string; data: TeacherData; refresh: () => Promise<void>; logout: () => void }) {
  const admin = teacher === "전체 관리자";
  const [tab, setTab] = useState<"home" | "answers" | "weekly" | "school" | "print" | "students" | "reset" | "admin">("home");
  const [studentFilter, setStudentFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [resetStudent, setResetStudent] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const activeRoster = data.roster.filter((row) => !row.enrollment_status || row.enrollment_status === "재원");
  const students = [...new Set(activeRoster.map((row) => String(row.student_name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  const classes = [...new Set(activeRoster.map((row) => String(row.class_name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  const visibleRoster = activeRoster.filter((row) => (!studentFilter || row.student_name === studentFilter) && (!classFilter || row.class_name === classFilter));
  const allowedPairs = useMemo(() => new Set(data.roster.flatMap((row) => splitRosterBooks(row.book_name).map((book) => `${row.student_name}\u0000${book}`))), [data.roster]);
  const matchingAnswers = data.wrongAnswers.filter((row) => admin || allowedPairs.has(`${row.username}\u0000${row.unit}`));
  const visibleAnswers = matchingAnswers.filter((row) => (!studentFilter || row.username === studentFilter) && (!classFilter || visibleRoster.some((item) => item.student_name === row.username && splitRosterBooks(item.book_name).includes(row.unit))));

  const week = useMemo(() => {
    const now = new Date();
    const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const monday = new Date(kst); monday.setDate(kst.getDate() - ((kst.getDay() + 6) % 7)); monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 7);
    const submitted = new Map<string, { numbers: Set<string>; books: Set<string> }>();
    for (const row of matchingAnswers) {
      const created = new Date(row.created_at);
      const createdKst = new Date(created.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
      if (createdKst < monday || createdKst >= sunday) continue;
      const current = submitted.get(row.username) || { numbers: new Set<string>(), books: new Set<string>() };
      try { parseProblemNumbers(row.problem).forEach((number) => current.numbers.add(number)); } catch { /* old malformed record */ }
      current.books.add(row.unit);
      submitted.set(row.username, current);
    }
    return { label: `${monday.toLocaleDateString("ko-KR")} ~ ${new Date(sunday.getTime() - 86400000).toLocaleDateString("ko-KR")}`, submitted };
  }, [matchingAnswers]);

  async function run(task: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await task(); } catch (error) { setMessage(error instanceof Error ? error.message : "처리하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function changePrint(id: number, isPrinted: boolean) {
    await run(async () => {
      await readJson(await fetch("/api/staff/print-status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, isPrinted }) }));
      await refresh(); setMessage("출력 상태를 변경했습니다.");
    });
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) { setMessage("임시 비밀번호 확인이 일치하지 않습니다."); return; }
    if (!window.confirm(`${resetStudent} 학생의 비밀번호를 초기화할까요?`)) return;
    await run(async () => {
      const result = await readJson(await fetch("/api/staff/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: resetStudent, password: newPassword }) }));
      setNewPassword(""); setConfirmPassword(""); await refresh(); setMessage(result.message);
    });
  }

  return <main className="shell dashboard-shell study-workspace">
    <section className="topbar"><div><span className="badge">스터디결 · {admin ? "전체 관리자" : "선생님"}</span><h1>{teacher}</h1></div><button className="ghost" onClick={logout}>로그아웃</button></section>
    <nav className="workspace-tabs" aria-label="선생님 메뉴">{[["home", "현황"], ["answers", "전체 오답"], ["weekly", "주간 제출"], ["school", "학교 기출"], ["print", "출력 관리"], ["students", "학생 명단"], ["reset", "비밀번호 관리"], ...(admin ? [["admin", "관리자 설정"]] : [])].map(([value, label]) => <button key={value} className={tab === value ? "active" : ""} onClick={() => { setTab(value as typeof tab); setMessage(""); }}>{label}</button>)}</nav>
    {message && <p className="workspace-message" role="status">{message}</p>}
    {(tab === "answers" || tab === "weekly" || tab === "students") && <section className="panel workspace-filters"><label>학생<select value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)}><option value="">전체</option>{students.map((student) => <option key={student}>{student}</option>)}</select></label><label>반<select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option value="">전체</option>{classes.map((className) => <option key={className}>{className}</option>)}</select></label></section>}
    {tab === "home" && <><section className="metrics"><article><b>{students.length}</b><span>재원 학생</span></article><article><b>{matchingAnswers.length}</b><span>조회된 오답</span></article><article><b>{data.printStatus.filter((row) => !row.is_printed).length}</b><span>출력 대기</span></article><article><b>{data.resetRequests.length}</b><span>재설정 요청</span></article></section><section className="grid2"><article className="panel"><h2>최근 오답</h2>{matchingAnswers.slice(0, 12).map((row) => <div className="row" key={row.id}><strong>{row.username} · {row.unit}</strong><span>{displayProblemNumbers(row.unit, row.problem)}번</span></div>)}</article><article className="panel"><h2>최근 오답노트 PDF</h2>{data.wrongNoteFiles.slice(0, 12).map((row) => <div className="row" key={row.id}><strong>{row.student_name}</strong><span>{row.original_filename}</span></div>)}</article></section><section className="panel"><h2>제출 보고서</h2>{data.reports.slice(0, 10).map((row) => <div className="row" key={row.id}><strong>{row.teacher_name} · {row.report_filename}</strong><span>마감 {row.cutoff_at}</span></div>)}</section></>}
    {tab === "answers" && <section className="panel"><h2>학생 오답 현황</h2><p>명단의 교재가 여러 개일 때 각각 분리해 연결합니다.</p>{visibleAnswers.length ? visibleAnswers.map((row) => <div className="row" key={row.id}><strong>{row.username} · {row.unit} · {displayProblemNumbers(row.unit, row.problem)}번</strong><span>{row.memo || ""} {row.created_at && `· ${new Date(row.created_at).toLocaleString("ko-KR")}`}</span></div>) : <p>조건에 맞는 오답이 없습니다.</p>}</section>}
    {tab === "weekly" && <section className="panel"><h2>이번 주 제출 현황</h2><p>{week.label}</p>{[...new Set(visibleRoster.map((row) => row.student_name))].map((student) => { const status = week.submitted.get(student); return <div className="row" key={student}><strong>{student} · {status?.numbers.size ? `제출 ${status.numbers.size}문항` : "미제출"}</strong><span>{status ? [...status.books].join(", ") : "이번 주 기록 없음"}</span></div>; })}</section>}
    {tab === "school" && <section className="panel"><h2>학교 기출 오답 현황</h2>{data.schoolWrongAnswers.map((row) => <div className="row" key={row.id}><strong>{row.username} · {data.schoolExams.find((exam) => exam.id === row.exam_id)?.display_name || `시험 ${row.exam_id}`} · {row.problem}번</strong><span>{row.memo || ""}</span></div>)}</section>}
    {tab === "print" && <section className="panel"><h2>오답 Paper 출력 관리</h2>{data.printStatus.map((row) => <div className="row workspace-record" key={row.id}><div><strong>{row.student_name} · {row.book_name}</strong><span>{row.class_name} · {row.month}월 {row.week}주 · {row.is_printed ? "출력 완료" : "출력 대기"}</span></div><div><button disabled={busy} onClick={() => void changePrint(row.id, !row.is_printed)}>{row.is_printed ? "출력 취소" : "출력 완료"}</button></div></div>)}</section>}
    {tab === "students" && <section className="panel"><h2>담당 학생 명단·가입 현황</h2>{visibleRoster.map((row) => <div className="row" key={row.id}><strong>{row.student_name} · {row.class_name}</strong><span>{row.school_name} · {row.grade} · {splitRosterBooks(row.book_name).join(", ")} · {data.users.some((user) => user.username === row.student_name) ? "가입 완료" : "미가입"}</span></div>)}</section>}
    {tab === "reset" && <section className="panel"><h2>학생 비밀번호 관리</h2><h3>처리 대기 요청</h3>{data.resetRequests.length ? data.resetRequests.map((row) => <div className="row" key={row.id}><strong>{row.username}</strong><span>{new Date(row.requested_at).toLocaleString("ko-KR")}</span></div>) : <p>대기 중인 요청이 없습니다.</p>}<h3>임시 비밀번호 발급</h3><form onSubmit={resetPassword} className="form workspace-form"><label>학생<select value={resetStudent} onChange={(event) => setResetStudent(event.target.value)} required><option value="">선택해주세요</option>{data.users.map((user) => <option key={user.username}>{user.username}</option>)}</select></label><label>새 임시 비밀번호<input type="password" minLength={4} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label><label>임시 비밀번호 확인<input type="password" minLength={4} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label><button className="primary" disabled={busy}>임시 비밀번호 발급</button></form></section>}
    {tab === "admin" && admin && <AdminPanel roster={data.roster} refreshRoster={refresh} />}
  </main>;
}
