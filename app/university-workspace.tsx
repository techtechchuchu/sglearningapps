"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import BrandLockup from "./brand-lockup";
import dynamic from "next/dynamic";
import "./university.css";

const UniversityMidterm = dynamic(() => import("./university-midterm"), { loading: () => <section className="panel" role="status">퀴즈를 준비하고 있어요.</section> });

type Course = { id: string; title: string; semester: string };
type Exam = { id: string; course_id: string; title: string; exam_date: string };
type Mistake = { id: string; course_id: string; problem_label: string; memo: string; reviewed: boolean; created_at: string };
type Data = { profile: { id: string; name: string; email: string; learnerType: string }; courses: Course[]; exams: Exam[]; mistakes: Mistake[] };
type View = "home" | "courses" | "exams" | "mistakes" | "quiz" | "helper";

export default function UniversityWorkspace({ logout }: { logout: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [view, setView] = useState<View>("home");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [courseTitle, setCourseTitle] = useState("");
  const [semester, setSemester] = useState("");
  const [examCourse, setExamCourse] = useState("");
  const [examTitle, setExamTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [mistakeCourse, setMistakeCourse] = useState("");
  const [problemLabel, setProblemLabel] = useState("");
  const [memo, setMemo] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/university", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "학습 기록을 불러오지 못했습니다.");
    setData(result);
  }, []);

  useEffect(() => { void refresh().catch((caught) => setError(caught.message)); }, [refresh]);

  async function save(event: FormEvent, body: Record<string, unknown>, clear: () => void) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/university", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "저장하지 못했습니다.");
      clear(); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "요청을 처리하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function toggleReview(item: Mistake) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/university", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, reviewed: !item.reviewed }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "복습 상태를 변경하지 못했습니다.");
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "요청을 처리하지 못했습니다."); }
    finally { setBusy(false); }
  }

  const courses = data?.courses || [];
  const exams = data?.exams || [];
  const mistakes = data?.mistakes || [];
  const pending = mistakes.filter((item) => !item.reviewed);
  const upcoming = exams.filter((item) => item.exam_date >= new Date().toISOString().slice(0, 10));
  const courseName = (id: string) => courses.find((course) => course.id === id)?.title || "과목";

  return <main className="shell dashboard-shell university-workspace">
    <header className="topbar university-topbar"><BrandLockup compact solo /><div><span className="badge">{data?.profile.learnerType === "school" ? "학생 개인 학습" : data?.profile.learnerType === "general" ? "개인 학습 공간" : "대학생 학습 모드"}</span><h1>{data?.profile.name || "나의 학습"}</h1><p>과목을 정리하고 시험까지 내 오답을 복습하세요.</p></div><button type="button" className="ghost" onClick={logout}>로그아웃</button></header>
    <nav className="workspace-tabs" aria-label="개인 학습 메뉴">{([["home", "오늘의 학습"], ["courses", "내 과목"], ["exams", "시험 준비"], ["quiz", "변형 퀴즈"], ["mistakes", "오답 복습"], ["helper", "결결이"]] as const).map(([id, label]) => <button type="button" key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>)}</nav>
    {view === "quiz" && data && <UniversityMidterm key={data.profile.email} userEmail={data.profile.email} />}
    {error && <p className="workspace-message" role="alert">{error}</p>}
    {!data && !error && <section className="panel" role="status">학습 기록을 불러오는 중입니다.</section>}
    {!data && error && <section className="panel"><button type="button" className="ghost" onClick={() => void refresh().then(() => setError("")).catch((caught) => setError(caught.message))}>다시 불러오기</button></section>}
    {view === "home" && data && <>
      <section className="university-hero panel"><div><span className="badge">오늘의 학습</span><h2>시험 전에, 내가 모르는 것부터.</h2><p>수업별 시험 일정과 아직 복습하지 않은 오답을 한눈에 확인하세요.</p></div><button type="button" className="primary" onClick={() => setView("mistakes")}>오답 복습하기</button></section>
      <section className="metrics university-metrics"><article><b>{courses.length}</b><span>등록한 과목</span></article><article><b>{upcoming.length}</b><span>다가오는 시험</span></article><article><b>{pending.length}</b><span>복습할 오답</span></article></section>
      <section className="panel university-hero"><div><span className="badge">대학생 공개 데모 · 변형 퀴즈</span><h2>미적분학2, 시험처럼 연습하세요.</h2><p>원본 해설과 동일 형식의 변형 3세트. 단답형·서술형을 풀고 정답과 풀이를 확인하세요.</p></div><button type="button" className="primary" onClick={() => setView("quiz")}>퀴즈 풀어보기 →</button></section>
      <section className="panel"><h2>다가오는 시험</h2>{upcoming.length ? upcoming.slice(0, 5).map((exam) => <div className="row" key={exam.id}><strong>{courseName(exam.course_id)} · {exam.title}</strong><span>{exam.exam_date}</span></div>) : <p>시험 일정을 등록하면 여기에 표시됩니다.</p>}</section>
    </>}
    {view === "courses" && data && <section className="panel"><h2>내 과목</h2><p>학원 반과 별개로 이번 학기 과목을 등록하세요.</p><form className="form university-form" onSubmit={(event) => void save(event, { kind: "course", title: courseTitle, semester }, () => { setCourseTitle(""); setSemester(""); })}><label>과목명<input value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} placeholder="예: 미적분학Ⅰ" required /></label><label>학기<input value={semester} onChange={(event) => setSemester(event.target.value)} placeholder="예: 2026년 2학기" /></label><button className="primary" disabled={busy}>과목 등록</button></form><div className="university-list">{courses.map((course) => <div className="row" key={course.id}><strong>{course.title}</strong><span>{course.semester || "학기 미지정"} · 오답 {mistakes.filter((item) => item.course_id === course.id).length}개</span></div>)}{!courses.length && <p>아직 등록한 과목이 없습니다.</p>}</div></section>}
    {view === "exams" && data && <section className="panel"><h2>시험 준비</h2><p>과목별 시험 날짜를 등록해두면 홈에서 가까운 일정부터 확인할 수 있습니다.</p><form className="form university-form" onSubmit={(event) => void save(event, { kind: "exam", courseId: examCourse, title: examTitle, examDate }, () => { setExamTitle(""); setExamDate(""); })}><label>과목<select value={examCourse} onChange={(event) => setExamCourse(event.target.value)} required><option value="">과목 선택</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label>시험명<input value={examTitle} onChange={(event) => setExamTitle(event.target.value)} placeholder="예: 중간고사" required /></label><label>시험 날짜<input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} required /></label><button className="primary" disabled={busy || !courses.length}>시험 등록</button></form><div className="university-list">{exams.map((exam) => <div className="row" key={exam.id}><strong>{courseName(exam.course_id)} · {exam.title}</strong><span>{exam.exam_date}</span></div>)}{!exams.length && <p>아직 등록한 시험이 없습니다.</p>}</div></section>}
    {view === "mistakes" && data && <section className="panel"><h2>내 오답 복습</h2><p>문제번호와 헷갈린 이유를 남기고 다시 풀었다면 복습 완료로 표시하세요.</p><form className="form university-form" onSubmit={(event) => void save(event, { kind: "mistake", courseId: mistakeCourse, problemLabel, memo }, () => { setProblemLabel(""); setMemo(""); })}><label>과목<select value={mistakeCourse} onChange={(event) => setMistakeCourse(event.target.value)} required><option value="">과목 선택</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label>문제번호·제목<input value={problemLabel} onChange={(event) => setProblemLabel(event.target.value)} placeholder="예: 3주차 과제 5번" required /></label><label>틀린 이유·복습 메모<textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="어떤 개념이 헷갈렸나요?" /></label><button className="primary" disabled={busy || !courses.length}>오답 저장</button></form><div className="university-list">{mistakes.map((item) => <div className="row university-mistake" key={item.id}><div><strong>{courseName(item.course_id)} · {item.problem_label}</strong><span>{item.memo || "메모 없음"}</span></div><button type="button" className={item.reviewed ? "reviewed" : ""} disabled={busy} onClick={() => void toggleReview(item)}>{item.reviewed ? "복습 완료 ✓" : "복습하기"}</button></div>)}{!mistakes.length && <p>아직 작성한 오답이 없습니다.</p>}</div></section>}
    {view === "helper" && data && <section className="panel university-helper"><span className="badge">결결이 · 학습 도우미 미리보기</span><h2>어떤 부분이 가장 막히나요?</h2><p>대학생용 결결이 상담 화면을 준비 중입니다. 현재는 실제 AI 답변이 연결되지 않았으며, 과목·시험·오답 기록은 다른 메뉴에서 이용할 수 있습니다.</p><div className="university-prompts"><span>시험 계획 세우기</span><span>오답 복습하기</span><span>공부 습관 점검하기</span></div></section>}
  </main>;
}
