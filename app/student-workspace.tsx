"use client";

import { FormEvent, useEffect, useState } from "react";
import { displayProblemNumbers, examIncludesSchool, parseProblemNumbers, splitRosterBooks } from "../lib/wrong-answers";
import BrandLockup from "./brand-lockup";
import StudentProblemBrowser from "./student-problem-browser";
import StudentAttendance from "./student-attendance";
import StudentLearningHub from "./student-learning-hub";
import { LegacyKakaoLink } from "./member-account";
import AccountManagement from "./account-management";
import { StudentQuestions } from "./learning-questions";
import { BOOK_PERIODS, BookPeriod, filterBooksByPeriod, finalBooksForRoster } from "../lib/book-periods";

type Row = Record<string, any>;
type Data = { roster: Row[]; wrongAnswers: Row[]; wrongNoteFiles: Row[]; notices: Row[]; mustChangePassword?: boolean; grade?: string };
type Exam = { id: number; school_name: string; display_name: string; exam_year: number; exam_type: string; question_count: number };
type SchoolAnswer = { id: number; exam_id: number; problem: string; memo: string; created_at: string };
type ExamOption = { id: string; school: string; label: string; max: number; edition: string; requiresConfirmation: boolean };
type ChannelRequest = { teacherName: string; channelName: string; channelUrl: string; book: string; problem: string; variantProblem: string; memo: string; requestId?: number };

const TEACHER_KAKAO_CHANNELS = [{ teacher: "이주백", channelName: "SG수학학원 이주백T", channelUrl: "https://pf.kakao.com/_hmxdiK/chat" }];

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
  const [examConfirmed, setExamConfirmed] = useState(false);
  const [variantChoice, setVariantChoice] = useState<"" | "yes" | "no">("");
  const [variantProblem, setVariantProblem] = useState("");
  const [wrongFormError, setWrongFormError] = useState("");
  const [wrongReviewReady, setWrongReviewReady] = useState(false);
  const [channelRequest, setChannelRequest] = useState<ChannelRequest | null>(null);
  const [channelOpened, setChannelOpened] = useState(false);
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
  const [moreOpen, setMoreOpen] = useState(false);

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

  const allBookExams = examsByBook[book] || [];
  const hasCurrentFinalEdition = allBookExams.some((item) => item.edition === "2026-2-final");
  const bookExams = bookPeriod === "2학기 기말" && hasCurrentFinalEdition
    ? allBookExams.filter((item) => item.edition === "2026-2-final")
    : allBookExams;
  const visibleBooks = booksForPeriod(books, bookPeriod);
  const chosenBookExam = bookExams.find((item) => item.id === examId);
  const studentSchools = [...new Set(data.roster.map((row) => String(row.school_name || "").trim()).filter(Boolean))];
  const suggestedExams = bookExams.filter((item) => studentSchools.some((school) => examIncludesSchool(item.school, school)));
  const otherExams = bookExams.filter((item) => !suggestedExams.includes(item));
  const chosenSchoolExam = schoolExams.find((item) => String(item.id) === schoolExamId);
  const assignedBooks = [...new Set(data.roster.flatMap((row) => splitRosterBooks(row.book_name)))];

  function reviewWrong() {
    if (!book) { setWrongFormError("교재를 선택해주세요."); return; }
    if (bookExams.length > 0 && !examId) { setWrongFormError("학교·시험을 선택해주세요."); return; }
    try {
      const numbers = parseProblemNumbers(problem);
      if (chosenBookExam && numbers.some((number) => Number(number) > chosenBookExam.max)) {
        setWrongFormError(`선택한 단원의 문제번호는 1~${chosenBookExam.max}번입니다.`);
        return;
      }
    } catch (error) { setWrongFormError(error instanceof Error ? error.message : "오답 문제번호를 확인해주세요."); return; }
    if (chosenBookExam?.requiresConfirmation && !examConfirmed) { setWrongFormError("교재의 학교·연도·묶음 표시를 확인해주세요."); return; }
    if (!variantChoice) { setWrongFormError("변형문제가 필요한지 선택해주세요."); return; }
    if (variantChoice === "yes") {
      try {
        const wrongNumbers = new Set(parseProblemNumbers(problem));
        const variantNumbers = parseProblemNumbers(variantProblem);
        if (variantNumbers.some((number) => !wrongNumbers.has(number))) {
          setWrongFormError("변형문제 번호는 위에 입력한 오답 문제번호 중에서 선택해주세요.");
          return;
        }
      } catch (error) {
        setWrongFormError(error instanceof Error ? error.message : "변형문제 번호를 확인해주세요.");
        return;
      }
    }
    setWrongFormError("");
    setMessage("");
    setWrongReviewReady(true);
    window.setTimeout(() => document.getElementById("wrong-inline-confirm")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }

  async function saveWrong() {
    await run(async () => {
      const result = await json(await fetch("/api/student/wrong-answers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ book, examId, examConfirmed, problem, memo, bookConfirmed: true, variantChoice, variantProblem }) }));
      const rosterRow = data.roster.find((row) => splitRosterBooks(row.book_name).includes(book));
      const teacherName = String(rosterRow?.teacher_name || "").trim();
      const channel = TEACHER_KAKAO_CHANNELS.find((item) => teacherName.includes(item.teacher)) || TEACHER_KAKAO_CHANNELS[0];
      setChannelOpened(false);
      setChannelRequest(variantChoice === "yes" ? { teacherName: teacherName || `${channel.teacher}T`, channelName: channel.channelName, channelUrl: channel.channelUrl, book, problem, variantProblem, memo, requestId: Number(result.row?.id) || undefined } : null);
      await refresh();
      setProblem(""); setMemo(""); setExamConfirmed(false); setVariantChoice(""); setVariantProblem(""); setWrongReviewReady(false);
      setMessage(variantChoice === "yes" ? "오답을 저장했습니다. 카카오채널 전송을 완료해야 다음 화면으로 이동할 수 있습니다." : `저장 확인 완료: ${result.saved.join(", ")}${result.duplicate.length ? ` · 중복 제외: ${result.duplicate.join(", ")}` : ""}`);
    });
  }

  function sendChannelRequest() {
    if (!channelRequest) return;
    const lines = [
      "[변형문제 요청]",
      `학생: ${name}`,
      `담당: ${channelRequest.teacherName}`,
      `교재: ${channelRequest.book}`,
      `오답 문제번호: ${channelRequest.problem}번`,
      `변형 요청번호: ${channelRequest.variantProblem}번`,
      channelRequest.memo ? `비고: ${channelRequest.memo}` : "",
      channelRequest.requestId ? `요청번호: ${channelRequest.requestId}` : "",
    ].filter(Boolean).join("\n");
    setChannelOpened(true);
    window.open(channelRequest.channelUrl, "_blank", "noopener,noreferrer");
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(lines).then(() => setMessage("요청 내용을 복사했습니다. 카카오채널 채팅방에 붙여넣어 전송해주세요.")).catch(() => setMessage("카카오채널이 열렸습니다. 아래 요청 내용을 직접 입력해 전송해주세요."));
    } else {
      setMessage("카카오채널이 열렸습니다. 아래 요청 내용을 직접 입력해 전송해주세요.");
    }
  }

  function completeChannelRequest() {
    if (!channelOpened) { setMessage("먼저 카카오채널을 열어 요청을 전송해주세요."); return; }
    setChannelRequest(null);
    setChannelOpened(false);
    setTab("home");
    setMessage("변형문제 요청 접수를 완료했습니다.");
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

  const myPageActive = tab === "records" || tab === "account";
  const moreActive = tab === "weekly" || tab === "questions" || tab === "learn" || tab === "attendance";

  function openTab(nextTab: typeof tab) {
    setTab(nextTab);
    setMoreOpen(false);
    setMessage("");
  }

  const wrongAnswerPanel = <section className="panel wrong-answer-panel"><h2>{tab === "home" ? "바로 오답 작성" : "오답 작성"}</h2>{tab === "home" && <p className="panel-intro">교재와 문제번호를 선택하면 이 화면에서 바로 오답을 저장할 수 있습니다.</p>}<form onSubmit={(event) => { event.preventDefault(); reviewWrong(); }} className="form workspace-form" noValidate>
    <fieldset className="book-period-picker"><legend>시험 시기 선택</legend><p>기말 교재는 현재 학년·반에 맞는 교재만 표시됩니다.</p><div role="group" aria-label="교재 시기 선택">{BOOK_PERIODS.map((period) => <button type="button" key={period} className={bookPeriod === period ? "active" : ""} aria-pressed={bookPeriod === period} onClick={() => { const nextBooks = booksForPeriod(books, period); setBookPeriod(period); setBook(nextBooks[0] || ""); setExamId(""); setExamConfirmed(false); }}>{period}</button>)}</div></fieldset>
    <label>{bookPeriod === "전체 교재" ? "전체 교재" : `${bookPeriod} 교재`}<select value={book} onChange={(event) => { setBook(event.target.value); setExamId(""); }} required><option value="">선택해주세요</option><optgroup label={bookPeriod}>{visibleBooks.map((item) => <option key={item}>{item}</option>)}</optgroup></select></label>
    {bookExams.length > 0 && <label>수록 학교·연도<select value={examId} required onChange={(event) => { setExamId(event.target.value); setExamConfirmed(false); }}><option value="">학교와 연도를 선택해주세요</option>{suggestedExams.length > 0 && <optgroup label="내 학교가 포함된 단원">{suggestedExams.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</optgroup>}{otherExams.length > 0 && <optgroup label="다른 학교·묶음 단원">{otherExams.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</optgroup>}</select><small>학교가 함께 적힌 단원은 한 묶음입니다. 내 학교가 포함돼도 실제로 푼 단원과 연도를 확인해주세요.</small></label>}
    {chosenBookExam && <p>{chosenBookExam.label} · 교재에 인쇄된 번호 1~{chosenBookExam.max}번을 입력하세요.</p>}
    <label>문제번호<input value={problem} onChange={(event) => setProblem(event.target.value)} placeholder="예: 3, 7, 12" required /></label>
    <label>비고<textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="계산 실수, 개념 헷갈림 등" /></label>
    <fieldset className="variant-choice"><legend>변형문제가 필요하세요?</legend><p>필요 여부를 반드시 선택해주세요.</p><div role="group" aria-label="변형문제 필요 여부"><button type="button" className={variantChoice === "yes" ? "active" : ""} aria-pressed={variantChoice === "yes"} onClick={() => setVariantChoice("yes")}>네, 필요해요</button><button type="button" className={variantChoice === "no" ? "active" : ""} aria-pressed={variantChoice === "no"} onClick={() => { setVariantChoice("no"); setVariantProblem(""); }}>아니요, 필요 없어요</button></div></fieldset>
    {variantChoice === "yes" && <label className="variant-number-input">변형문제가 필요한 번호를 입력해주세요<input value={variantProblem} onChange={(event) => setVariantProblem(event.target.value)} placeholder="예: 3, 12" required /><small>위에서 입력한 오답 문제번호 중 변형문제가 필요한 번호만 입력해주세요.</small></label>}
    {chosenBookExam?.requiresConfirmation && <label className="workspace-check"><input type="checkbox" checked={examConfirmed} onChange={(event) => setExamConfirmed(event.target.checked)} required /> 교재의 학교·연도·묶음 표시와 문제번호를 확인했습니다.</label>}
    {wrongFormError && <p className="wrong-form-error" role="alert">{wrongFormError}</p>}
    {!wrongReviewReady && <button type="button" className="primary" onClick={reviewWrong} disabled={busy}>제출 내용 확인하기</button>}
    {wrongReviewReady && <section id="wrong-inline-confirm" className="wrong-inline-confirm" aria-labelledby="wrong-inline-title"><span>최종 확인</span><h3 id="wrong-inline-title">이 내용으로 제출할까요?</h3><dl><div><dt>시험 시기</dt><dd>{bookPeriod}</dd></div><div><dt>교재</dt><dd>{book}</dd></div>{chosenBookExam && <div><dt>수록 학교·연도</dt><dd>{chosenBookExam.label}</dd></div>}<div><dt>오답 문제번호</dt><dd>{problem}번</dd></div><div className={variantChoice === "yes" ? "is-variant" : ""}><dt>변형문제</dt><dd>{variantChoice === "yes" ? `${variantProblem}번 요청` : "요청하지 않음"}</dd></div>{memo && <div><dt>비고</dt><dd>{memo}</dd></div>}</dl><p>선택한 교재와 문제번호가 실제 오답과 일치하는지 확인해주세요.</p><div><button type="button" className="ghost" onClick={() => setWrongReviewReady(false)} disabled={busy}>다시 수정하기</button><button type="button" className="primary" onClick={() => void saveWrong()} disabled={busy}>{busy ? "제출 중..." : variantChoice === "yes" ? "맞습니다 · 채널 전송 단계로" : "맞습니다 · 제출하기"}</button></div></section>}
  </form></section>;

  return <main className="shell dashboard-shell study-workspace">
    <section className="topbar student-topbar"><BrandLockup compact /><div><span className="badge">내 오답노트</span><h1>{name} 학생</h1><p>{data.grade || ""} · {data.roster.map((row) => row.class_name).filter(Boolean).join(", ")}</p></div><div className="student-topbar-actions"><button type="button" className={`student-ai-counselor${tab === "helper" ? " active" : ""}`} aria-current={tab === "helper" ? "page" : undefined} onClick={() => openTab("helper")}>✦ AI 상담사 결결이</button><button type="button" className="ghost" onClick={logout}>로그아웃</button></div></section>
    <nav className="workspace-tabs student-primary-tabs" aria-label="학생 주요 메뉴">
      <button type="button" className={tab === "home" ? "active" : ""} aria-current={tab === "home" ? "page" : undefined} onClick={() => openTab("home")}>홈</button>
      <button type="button" className={tab === "wrong" ? "active" : ""} aria-current={tab === "wrong" ? "page" : undefined} onClick={() => openTab("wrong")}>오답 작성</button>
      <button type="button" className={tab === "school" ? "active" : ""} aria-current={tab === "school" ? "page" : undefined} onClick={() => openTab("school")}>학교 기출</button>
      <button type="button" className={myPageActive ? "active" : ""} aria-expanded={myPageActive} onClick={() => openTab("records")}>마이페이지</button>
      <button type="button" className={moreOpen || moreActive ? "active" : ""} aria-expanded={moreOpen || moreActive} onClick={() => { setMoreOpen((current) => !current); setMessage(""); }}>기능 더보기</button>
    </nav>
    {myPageActive && <nav className="student-secondary-menu" aria-label="마이페이지 메뉴"><button type="button" className={tab === "records" ? "active" : ""} onClick={() => openTab("records")}>내 기록</button><button type="button" className={tab === "account" ? "active" : ""} onClick={() => openTab("account")}>계정 관리</button></nav>}
    {(moreOpen || moreActive) && <nav className="student-secondary-menu" aria-label="추가 학습 기능">{[["weekly", "주간 학습기록"], ["questions", "질문함"], ["learn", "문제별 해설"], ["attendance", "출석 체크"]].map(([value, label]) => <button type="button" key={value} className={tab === value ? "active" : ""} onClick={() => openTab(value as typeof tab)}>{label}</button>)}</nav>}
    {tab === "account" && !data.mustChangePassword && <LegacyKakaoLink />}
    {message && <p className="workspace-message" role="status">{message}</p>}
    {channelRequest && <div className="channel-request-lock"><section className="channel-request-card" role="dialog" aria-modal="true" aria-labelledby="channel-request-title"><div><span>필수 전송 단계</span><h2 id="channel-request-title">{channelRequest.channelName} 채널로 보내주세요</h2><p>다음 화면으로 이동하려면 카카오채널에서 변형문제 요청을 전송해야 합니다. 아래 버튼을 누르면 요청 내용이 복사되고 채널이 열립니다.</p></div><dl><div><dt>담당</dt><dd>{channelRequest.teacherName}</dd></div><div><dt>교재</dt><dd>{channelRequest.book}</dd></div><div><dt>오답 번호</dt><dd>{channelRequest.problem}번</dd></div><div><dt>변형 요청</dt><dd>{channelRequest.variantProblem}번</dd></div></dl><div className="channel-request-actions"><button type="button" className="channel-request-button" onClick={sendChannelRequest}>{channelOpened ? "카카오채널 다시 열기" : "카카오채널로 요청 보내기"}</button>{channelOpened && <button type="button" className="channel-request-complete" onClick={completeChannelRequest}>카카오채널에서 전송했습니다</button>}</div><small>카카오 정책상 실제 메시지 전송 여부는 자동으로 확인할 수 없습니다. 채팅방에서 붙여넣기 후 전송 버튼을 꼭 눌러주세요.</small></section></div>}
    {data.mustChangePassword && tab !== "account" ? <section className="panel"><h2>임시 비밀번호 변경 필요</h2><p>새 비밀번호를 설정한 뒤 오답노트를 이용할 수 있습니다.</p><button className="primary" onClick={() => setTab("account")}>비밀번호 변경하기</button></section> : null}
    {tab === "home" && !data.mustChangePassword && <StudentLearningHub view="home" name={name} answers={data.wrongAnswers} schoolAnswers={schoolAnswers} onNavigate={openTab} />}
    {(tab === "weekly" || tab === "helper") && !data.mustChangePassword && <StudentLearningHub view={tab} name={name} answers={data.wrongAnswers} schoolAnswers={schoolAnswers} onNavigate={openTab} />}
    {(tab === "home" || tab === "wrong") && !data.mustChangePassword && wrongAnswerPanel}
    {tab === "questions" && !data.mustChangePassword && <StudentQuestions classes={[...new Map(data.roster.filter((row) => row.enrollment_status !== "퇴원").map((row) => [`${row.teacher_name}\0${row.class_name}`, { teacherName: String(row.teacher_name || ""), className: String(row.class_name || "") }])).values()].filter((item) => item.teacherName && item.className)} />}
    {tab === "school" && !data.mustChangePassword && <section className="panel"><h2>학교 기출 오답</h2><form onSubmit={saveSchool} className="form workspace-form">
      <label>학교·시험<select value={schoolExamId} required onChange={(event) => setSchoolExamId(event.target.value)}><option value="">선택해주세요</option>{schoolExams.map((exam) => <option key={exam.id} value={exam.id}>{exam.display_name || `${exam.exam_year} ${exam.school_name} ${exam.exam_type}`}</option>)}</select></label>
      {chosenSchoolExam && <p>총 {chosenSchoolExam.question_count || "?"}문항</p>}
      <label>오답번호<input value={schoolProblem} onChange={(event) => setSchoolProblem(event.target.value)} placeholder="예: 3, 7, 12" required /></label>
      <label>비고<textarea value={schoolMemo} onChange={(event) => setSchoolMemo(event.target.value)} /></label>
      <label className="workspace-check"><input type="checkbox" checked={schoolConfirmed} onChange={(event) => setSchoolConfirmed(event.target.checked)} required /> 선택한 학교·시험이 맞습니다.</label>
      <button className="primary" disabled={busy}>학교 기출 저장하고 확인하기</button>
    </form><h3>내 학교 기출 기록</h3>{schoolAnswers.map((answer) => <div className="row" key={answer.id}><strong>{schoolExams.find((exam) => exam.id === answer.exam_id)?.display_name || `시험 ${answer.exam_id}`} · {answer.problem}번</strong><span>{answer.memo}</span></div>)}</section>}
    {tab === "records" && <><section className="metrics"><article><b>{data.wrongAnswers.length}</b><span>오답 기록</span></article><article><b>{schoolAnswers.length}</b><span>학교 기출</span></article><article><b>{assignedBooks.length}</b><span>명단 교재</span></article><article><b>{data.wrongNoteFiles.length}</b><span>PDF</span></article></section><section className="panel"><h2>내 수업·교재</h2>{data.roster.map((row, index) => <div className="row" key={row.id || index}><strong>{row.class_name || "반 미지정"}</strong><span>{row.teacher_name} · {splitRosterBooks(row.book_name).join(" · ") || "교재 미지정"}</span></div>)}</section><section className="panel"><h2>내 오답 목록</h2>{data.wrongAnswers.length ? data.wrongAnswers.map((row) => <div className="row workspace-record" key={row.id}><div><strong>{row.unit} · {displayProblemNumbers(row.unit, row.problem)}번</strong><span>{row.memo || ""} · {new Date(row.created_at).toLocaleString("ko-KR")}</span></div>{editId === row.id ? <div><textarea value={editMemo} onChange={(event) => setEditMemo(event.target.value)} /><button disabled={busy} onClick={() => void updateMemo(row.id)}>저장</button><button onClick={() => setEditId(null)}>취소</button></div> : <div><button onClick={() => { setEditId(row.id); setEditMemo(row.memo || ""); }}>비고 수정</button><button disabled={busy} onClick={() => void removeWrong(row.id)}>삭제</button></div>}</div>) : <p>저장된 오답이 없습니다.</p>}</section><section className="panel"><h2>오답노트 PDF 기록</h2>{data.wrongNoteFiles.map((row, index) => <div className="row" key={row.id || index}><strong>{row.original_filename || "오답노트"}</strong><span>{row.subject_name || ""} {row.round_number ? `· ${row.round_number}회` : ""} {row.id && <a href={`/api/files/wrong-note/${row.id}`} target="_blank" rel="noopener noreferrer">PDF 열기</a>}</span></div>)}</section></>}
    {tab === "account" && <><AccountManagement logout={logout} /><section className="panel"><h2>로그인·보안</h2>{data.mustChangePassword && <p>임시 비밀번호로 로그인했습니다. 새 비밀번호를 설정해주세요.</p>}<form onSubmit={changePassword} className="form workspace-form"><label>현재 비밀번호<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label><label>새 비밀번호<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required /></label><label>새 비밀번호 확인<input type="password" value={newPasswordAgain} onChange={(event) => setNewPasswordAgain(event.target.value)} minLength={8} required /></label><button className="primary" disabled={busy}>비밀번호 변경</button></form></section></>}
    {tab === "attendance" && !data.mustChangePassword && <StudentAttendance classes={(() => {
      const classes = [...new Map(data.roster.filter((row) => row.enrollment_status !== "퇴원").map((row) => {
        const className = String(row.class_name || "").trim();
        const teacherName = String(row.teacher_name || "").trim();
        return [`${teacherName}\0${className}`, { className, teacherName }];
      }).filter(([key]) => !String(key).startsWith("\0") && !String(key).endsWith("\0")) as Array<[string, { className: string; teacherName: string }]>).values()];
      return classes.length ? classes : name === "추재현" ? [{ className: "출석 데모반", teacherName: "전체 관리자" }] : [];
    })()} />}
    {tab === "learn" && !data.mustChangePassword && <StudentProblemBrowser studentName={name} studentSchools={studentSchools} books={books} schoolExams={schoolExams} wrongAnswers={data.wrongAnswers} schoolAnswers={schoolAnswers} onWrite={(kind, selectedBook, selectedExam, number) => {
      if (kind === "xpattern") { const selectedEdition = examsByBook[selectedBook]?.find((item) => item.id === selectedExam)?.edition; setBookPeriod(selectedEdition === "2026-2-final" ? "2학기 기말" : "전체 교재"); setBook(selectedBook); setExamId(selectedExam); setProblem(String(number)); setExamConfirmed(false); setTab("wrong"); }
      else { setSchoolExamId(selectedExam); setSchoolProblem(String(number)); setSchoolConfirmed(false); setTab("school"); }
      setMessage("선택한 문제번호를 입력했습니다. 내용을 확인하고 저장해주세요.");
    }} />}
  </main>;
}

