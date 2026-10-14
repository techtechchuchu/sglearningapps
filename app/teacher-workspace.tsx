"use client";

import { FormEvent, useMemo, useState } from "react";
import { displayProblemNumbers, parseProblemNumbers, splitRosterBooks } from "../lib/wrong-answers";
import AdminPanel from "./admin-panel";
import SubmissionReportUpload from "./submission-report-upload";
import RosterActions from "./roster-actions";
import StudentDetail from "./student-detail";
import BrandLockup from "./brand-lockup";
import ReportStatusPanel from "./report-status-panel";
import TeacherExplanations from "./teacher-explanations";

type Row = Record<string, any>;
export type TeacherData = { roster: Row[]; wrongAnswers: Row[]; wrongNoteFiles: Row[]; reports: Row[]; printStatus: Row[]; schoolWrongAnswers: Row[]; schoolExams: Row[]; resetRequests: Row[]; users: Row[]; activeBooks: string[] };

async function readJson(response: Response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `요청 실패 (${response.status})`);
  return result;
}

function koreanDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export default function TeacherWorkspace({ teacher, data, refresh, logout }: { teacher: string; data: TeacherData; refresh: () => Promise<void>; logout: () => void }) {
  const admin = teacher === "전체 관리자";
  const [tab, setTab] = useState<"home" | "answers" | "weekly" | "daily" | "missing" | "school" | "paper" | "print" | "explanations" | "detail" | "students" | "register" | "exited" | "reset" | "admin">("home");
  const [studentFilter, setStudentFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [submissionDate, setSubmissionDate] = useState(() => koreanDate(new Date()));
  const [resetStudent, setResetStudent] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [paperTeacher, setPaperTeacher] = useState(admin ? "" : teacher);
  const [paperClass, setPaperClass] = useState("");
  const [paperBook, setPaperBook] = useState("");
  const [paperStudents, setPaperStudents] = useState<string[]>([]);
  const [paperMonth, setPaperMonth] = useState(new Date().getMonth() + 1);
  const [paperWeek, setPaperWeek] = useState(Math.min(5, Math.floor((new Date().getDate() - 1) / 7) + 1));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const activeRoster = data.roster.filter((row) => !row.enrollment_status || row.enrollment_status === "재원");
  const students = [...new Set(activeRoster.map((row) => String(row.student_name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  const classes = [...new Set(activeRoster.map((row) => String(row.class_name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  const visibleRoster = activeRoster.filter((row) => (!studentFilter || row.student_name === studentFilter) && (!classFilter || row.class_name === classFilter));
  const allowedPairs = useMemo(() => new Set(data.roster.flatMap((row) => splitRosterBooks(row.book_name).map((book) => `${row.student_name}\u0000${book}`))), [data.roster]);
  const matchingAnswers = data.wrongAnswers.filter((row) => admin || allowedPairs.has(`${row.username}\u0000${row.unit}`));
  const variantRequests = matchingAnswers.filter((row) => String(row.memo || "").includes("변형"));
  const latestReports = data.reports.filter((row, index, rows) => rows.findIndex((candidate) => candidate.teacher_name === row.teacher_name) === index);
  const visibleAnswers = matchingAnswers.filter((row) => (!studentFilter || row.username === studentFilter) && (!classFilter || visibleRoster.some((item) => item.student_name === row.username && splitRosterBooks(item.book_name).includes(row.unit))));
  const datedAnswers = matchingAnswers.filter((row) => {
    if (!row.created_at || !row.username) return false;
    const date = new Date(row.created_at);
    return !Number.isNaN(date.getTime()) && koreanDate(date) === submissionDate;
  });
  const submittedToday = new Set(datedAnswers.map((row) => String(row.username)));
  const missingStudents = [...new Set(visibleRoster.map((row) => String(row.student_name || "").trim()).filter(Boolean))].filter((name) => !submittedToday.has(name));
  const dailyByStudent = [...new Set(datedAnswers.map((row) => String(row.username)))].sort((a, b) => a.localeCompare(b, "ko")).map((name) => {
    const answers = datedAnswers.filter((row) => row.username === name);
    const problems = answers.reduce((count, row) => { try { return count + parseProblemNumbers(row.problem).length; } catch { return count; } }, 0);
    return { name, records: answers.length, problems };
  });
  const visibleDaily = dailyByStudent.filter((row) => (!studentFilter || row.name === studentFilter) && (!classFilter || visibleRoster.some((item) => item.student_name === row.name)));
  const paperRoster = activeRoster.filter((row) => row.teacher_name === paperTeacher && row.class_name === paperClass);
  const paperBooks = [...new Set(paperRoster.flatMap((row) => splitRosterBooks(row.book_name)))];
  const eligiblePaperStudents = [...new Set(paperRoster.filter((row) => splitRosterBooks(row.book_name).includes(paperBook)).map((row) => row.student_name))];

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

  async function downloadPaper(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const response = await fetch("/api/staff/paper-export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teacher: paperTeacher, className: paperClass, book: paperBook, students: paperStudents, month: paperMonth, week: paperWeek }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "엑셀을 만들지 못했습니다.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${paperTeacher}_${paperClass}_${paperMonth}월_${paperWeek}주차_오답노트생성.xlsx`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      await refresh(); setMessage("오답 Paper 엑셀을 만들고 출력 대기 목록에 등록했습니다.");
    });
  }

  const group = ["home", "answers", "weekly", "daily", "school", "missing"].includes(tab) ? "answers" : ["detail", "students", "register", "exited", "reset", "admin"].includes(tab) ? "students" : "paper";
  const menus: Array<[typeof tab, string]> = group === "answers"
    ? [["home", "🏠 홈"], ["answers", "📋 전체 오답"], ["weekly", "🗓️ 주간 제출"], ["daily", "🗓️ 날짜별 제출량"], ["school", "🏫 학교 기출"], ["missing", "🚨 미제출"]]
    : group === "students"
      ? [["detail", "👤 학생 상세"], ["register", "➕ 신규생 등록"], ["students", "🏫 반 학생·가입"], ["exited", "🚪 퇴원생 관리"], ["reset", "🔑 비밀번호 관리"], ...(admin ? [["admin", "⚙️ 관리자 설정"] as [typeof tab, string]] : [])]
      : [["paper", "📄 오답 Paper 엑셀"], ["print", "🖨️ 출력 관리"], ["explanations", "▶ 문제별 해설"]];

  return <main className="shell dashboard-shell study-workspace">
    <section className="staff-header"><BrandLockup /><div className="staff-heading"><h1>👨‍🏫 선생님 관리</h1><p>현재 로그인: {teacher}</p></div><button className="ghost" onClick={logout}>로그아웃</button></section>
    <nav className="workspace-group-tabs" aria-label="관리 영역"><button className={group === "answers" ? "active" : ""} onClick={() => setTab("home")}>📝 오답 관리</button><button className={group === "students" ? "active" : ""} onClick={() => setTab("students")}>👥 학생 관리</button><button className={group === "paper" ? "active" : ""} onClick={() => setTab("paper")}>🖨️ 오답노트 · 출력</button></nav>
    <nav className="workspace-tabs staff-subtabs" aria-label="세부 메뉴">{menus.map(([value, label]) => <button key={value} className={tab === value ? "active" : ""} onClick={() => { setTab(value); setMessage(""); }}>{label}</button>)}</nav>
    {message && <p className="workspace-message" role="status">{message}</p>}
    {(tab === "answers" || tab === "weekly" || tab === "daily" || tab === "missing" || tab === "students") && <section className="panel workspace-filters">{(tab === "daily" || tab === "missing") && <label>기준 날짜<input type="date" value={submissionDate} onChange={(event) => setSubmissionDate(event.target.value)} /></label>}<label>학생<select value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)}><option value="">전체</option>{students.map((student) => <option key={student}>{student}</option>)}</select></label><label>반<select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option value="">전체</option>{classes.map((className) => <option key={className}>{className}</option>)}</select></label></section>}
    {tab === "home" && <>
      <section className="panel"><h2>🏠 오답노트 관리 홈</h2><p>{admin ? "저장된 보고서 기준, 학생 제출 현황과 변형문제 요청을 한 화면에서 확인합니다." : "전체 관리자가 저장한 보고서 기준과 담당 학생 현황을 확인합니다."}</p></section>
      {admin && <SubmissionReportUpload refresh={refresh} />}
      <section className="panel"><h2>📄 최신 저장 보고서</h2>{latestReports.length ? <div className="metrics">{latestReports.map((row) => <article key={row.id}><b>{row.teacher_name}</b><span>최근 제출 마감 {row.cutoff_at ? new Date(row.cutoff_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "-"}</span><small>대상 {row.target_count ?? "-"}명 · {row.note_count ?? "-"}건</small></article>)}</div> : <p>아직 저장된 보고서가 없습니다.</p>}</section>
      <ReportStatusPanel roster={data.roster} answers={data.wrongAnswers} reports={data.reports} />
      <section className="metrics"><article><b>{students.length}</b><span>재원 학생</span></article><article><b>{matchingAnswers.length}</b><span>조회된 오답</span></article><article><b>{data.printStatus.filter((row) => !row.is_printed).length}</b><span>출력 대기</span></article><article><b>{data.resetRequests.length}</b><span>재설정 요청</span></article></section>
      <section className="panel"><h2>🧩 변형문제 요청</h2><div className="metrics"><article><b>{new Set(variantRequests.map((row) => row.username)).size}</b><span>요청 학생</span></article><article><b>{variantRequests.length}</b><span>요청 건수</span></article></div><details><summary>전체 요청 보기 · {variantRequests.length}건</summary>{variantRequests.map((row) => <div className="row" key={row.id}><strong>{row.username} · {row.unit} · {displayProblemNumbers(row.unit, row.problem)}번</strong><span>{row.memo || ""}</span></div>)}</details></section>
      <section className="grid2"><article className="panel"><h2>최근 오답</h2>{matchingAnswers.slice(0, 12).map((row) => <div className="row" key={row.id}><strong>{row.username} · {row.unit}</strong><span>{displayProblemNumbers(row.unit, row.problem)}번</span></div>)}</article><article className="panel"><h2>최근 오답노트 PDF</h2>{data.wrongNoteFiles.slice(0, 12).map((row) => <div className="row" key={row.id}><strong>{row.student_name}</strong><span>{row.original_filename} {row.id && <a href={`/api/files/wrong-note/${row.id}`} target="_blank" rel="noopener noreferrer">PDF 열기</a>}</span></div>)}</article></section>
    </>}
    {tab === "answers" && <section className="panel"><h2>학생 오답 현황</h2><p>명단의 교재가 여러 개일 때 각각 분리해 연결합니다.</p>{visibleAnswers.length ? visibleAnswers.map((row) => <div className="row" key={row.id}><strong>{row.username} · {row.unit} · {displayProblemNumbers(row.unit, row.problem)}번</strong><span>{row.memo || ""} {row.created_at && `· ${new Date(row.created_at).toLocaleString("ko-KR")}`}</span></div>) : <p>조건에 맞는 오답이 없습니다.</p>}</section>}
    {tab === "weekly" && <section className="panel"><h2>이번 주 제출 현황</h2><p>{week.label}</p>{[...new Set(visibleRoster.map((row) => row.student_name))].map((student) => { const status = week.submitted.get(student); return <div className="row" key={student}><strong>{student} · {status?.numbers.size ? `제출 ${status.numbers.size}문항` : "미제출"}</strong><span>{status ? [...status.books].join(", ") : "이번 주 기록 없음"}</span></div>; })}</section>}
    {tab === "daily" && <section className="panel"><h2>날짜별 제출량</h2><p>{submissionDate} · 한국 시간 기준</p><div className="metrics"><article><b>{visibleDaily.length}</b><span>제출 학생</span></article><article><b>{visibleDaily.reduce((sum, row) => sum + row.records, 0)}</b><span>오답 기록</span></article><article><b>{visibleDaily.reduce((sum, row) => sum + row.problems, 0)}</b><span>제출 문항</span></article></div>{visibleDaily.map((row) => <div className="row" key={row.name}><strong>{row.name}</strong><span>오답 {row.records}건 · 문제 {row.problems}문항</span></div>)}</section>}
    {tab === "missing" && <section className="panel"><h2>미제출 학생</h2><p>{submissionDate}에 오답 기록이 없는 재원 학생 · {missingStudents.length}명</p>{missingStudents.length ? missingStudents.map((name) => <div className="row" key={name}><strong>{name}</strong><span>{[...new Set(visibleRoster.filter((row) => row.student_name === name).map((row) => row.class_name).filter(Boolean))].join(", ")}</span></div>) : <p>선택한 명단의 학생이 모두 제출했습니다.</p>}</section>}
    {tab === "school" && <section className="panel"><h2>학교 기출 오답 현황</h2>{data.schoolWrongAnswers.map((row) => <div className="row" key={row.id}><strong>{row.username} · {data.schoolExams.find((exam) => exam.id === row.exam_id)?.display_name || `시험 ${row.exam_id}`} · {row.problem}번</strong><span>{row.memo || ""}</span></div>)}</section>}
    {tab === "paper" && <section className="panel"><h2>오답 Paper 생성용 엑셀</h2><p>학생·반·교재를 선택하면 기존 앱과 같은 열 형식의 엑셀을 만듭니다. 다운로드 시 출력 대기 목록에도 등록됩니다.</p><form onSubmit={downloadPaper} className="form workspace-form">
      {admin && <label>담당 선생님<select value={paperTeacher} onChange={(event) => { setPaperTeacher(event.target.value); setPaperClass(""); setPaperBook(""); setPaperStudents([]); }} required><option value="">선택해주세요</option>{[...new Set(data.roster.map((row) => row.teacher_name).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</select></label>}
      <label>반<select value={paperClass} onChange={(event) => { setPaperClass(event.target.value); setPaperBook(""); setPaperStudents([]); }} required><option value="">선택해주세요</option>{[...new Set(activeRoster.filter((row) => row.teacher_name === paperTeacher).map((row) => row.class_name).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>교재<select value={paperBook} onChange={(event) => { setPaperBook(event.target.value); setPaperStudents([]); }} required><option value="">선택해주세요</option>{paperBooks.map((item) => <option key={item}>{item}</option>)}</select></label>
      <fieldset><legend>학생 선택</legend>{eligiblePaperStudents.map((student) => <label className="workspace-check" key={student}><input type="checkbox" checked={paperStudents.includes(student)} onChange={(event) => setPaperStudents(event.target.checked ? [...paperStudents, student] : paperStudents.filter((name) => name !== student))} /> {student}</label>)}</fieldset>
      <label>월<select value={paperMonth} onChange={(event) => setPaperMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}월</option>)}</select></label><label>주차<select value={paperWeek} onChange={(event) => setPaperWeek(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((weekNumber) => <option key={weekNumber} value={weekNumber}>{weekNumber}주차</option>)}</select></label>
      <button className="primary" disabled={busy || !paperStudents.length}>엑셀 다운로드</button>
    </form></section>}
    {tab === "print" && <section className="panel"><h2>오답 Paper 출력 관리</h2>{data.printStatus.map((row) => <div className="row workspace-record" key={row.id}><div><strong>{row.student_name} · {row.book_name}</strong><span>{row.class_name} · {row.month}월 {row.week}주 · {row.is_printed ? "출력 완료" : "출력 대기"}</span></div><div><button disabled={busy} onClick={() => void changePrint(row.id, !row.is_printed)}>{row.is_printed ? "출력 취소" : "출력 완료"}</button></div></div>)}</section>}
    {tab === "explanations" && <TeacherExplanations books={[...new Set([...(data.activeBooks || []), ...data.roster.flatMap((row) => splitRosterBooks(row.book_name))])]} schoolExams={data.schoolExams || []} />}
    {tab === "students" && <section className="panel"><h2>담당 학생 명단·가입 현황</h2>{visibleRoster.map((row) => <div className="row" key={row.id}><strong>{row.student_name} · {row.class_name}</strong><span>{row.school_name} · {row.grade} · {splitRosterBooks(row.book_name).join(", ")} · {data.users.some((user) => user.username === row.student_name) ? "가입 완료" : "미가입"}</span></div>)}</section>}
    {tab === "detail" && <StudentDetail teacher={teacher} roster={data.roster} answers={matchingAnswers} users={data.users} files={data.wrongNoteFiles} schoolAnswers={data.schoolWrongAnswers} schoolExams={data.schoolExams} />}
    {(tab === "register" || tab === "exited") && <RosterActions mode={tab} teacher={teacher} roster={data.roster} activeBooks={data.activeBooks || []} refresh={refresh} />}
    {tab === "reset" && <section className="panel"><h2>학생 비밀번호 관리</h2><h3>처리 대기 요청</h3>{data.resetRequests.length ? data.resetRequests.map((row) => <div className="row" key={row.id}><strong>{row.username}</strong><span>{new Date(row.requested_at).toLocaleString("ko-KR")}</span></div>) : <p>대기 중인 요청이 없습니다.</p>}<h3>임시 비밀번호 발급</h3><form onSubmit={resetPassword} className="form workspace-form"><label>학생<select value={resetStudent} onChange={(event) => setResetStudent(event.target.value)} required><option value="">선택해주세요</option>{data.users.map((user) => <option key={user.username}>{user.username}</option>)}</select></label><label>새 임시 비밀번호<input type="password" minLength={4} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label><label>임시 비밀번호 확인<input type="password" minLength={4} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label><button className="primary" disabled={busy}>임시 비밀번호 발급</button></form></section>}
    {tab === "admin" && admin && <AdminPanel roster={data.roster} refreshRoster={refresh} />}
  </main>;
}

