"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import BrandLockup from "./brand-lockup";
import dynamic from "next/dynamic";
import { UniversityHome, UniversityStudyMap } from "./university-home";
import "./university.css";

const UniversityMidterm = dynamic(() => import("./university-midterm"), { loading: () => <section className="panel" role="status">퀴즈를 준비하고 있어요.</section> });
const UniversityMockExam = dynamic(() => import("./university-mock-exam"), { loading: () => <section className="panel" role="status">모의고사를 준비하고 있어요.</section> });
const PythonLab = dynamic(() => import("./python-lab"), { loading: () => <section className="panel" role="status">파이썬 연습실을 준비하고 있어요.</section> });

type Course = { id: string; title: string; semester: string };
type Exam = { id: string; course_id: string; title: string; exam_date: string };
type Mistake = { id: string; course_id: string; problem_label: string; memo: string; reviewed: boolean; created_at: string };
type Data = { profile: { id: string; name: string; email: string; learnerType: string }; courses: Course[]; exams: Exam[]; mistakes: Mistake[] };
type View = "home" | "map" | "courses" | "exams" | "mistakes" | "quiz" | "competition" | "python" | "helper";

export default function UniversityWorkspace({ logout }: { logout: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [view, setView] = useState<View>("home");
  const [mapCourseId, setMapCourseId] = useState("");
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
  const courseName = (id: string) => courses.find((course) => course.id === id)?.title || "과목";

  return <main className="shell dashboard-shell university-workspace">
    <header className="topbar university-topbar"><BrandLockup compact solo /><div><span className="badge">{data?.profile.learnerType === "school" ? "학생 개인 학습" : data?.profile.learnerType === "general" ? "개인 학습 공간" : "대학생 학습 모드"}</span><h1>{data?.profile.name || "나의 학습"}</h1><p>과목을 정리하고 시험까지 내 오답을 복습하세요.</p></div><button type="button" className="ghost" onClick={logout}>로그아웃</button></header>
    <nav className="workspace-tabs university-nav" aria-label="개인 학습 메뉴"><span className="university-nav-label">WORKSPACE</span>{([["home", "나의 홈"], ["map", "학습 지도"], ["courses", "내 과목"], ["exams", "시험 준비"], ["mistakes", "오답 복습"], ["quiz", "변형 퀴즈"], ...(data?.profile.learnerType === "university" ? [["competition", "공식 모의고사"]] as const : []), ["python", "파이썬 연습실"], ["helper", "결결이"]] as const).map(([id, label]) => <button type="button" key={id} className={view === id ? "active" : ""} aria-current={view === id ? "page" : undefined} onClick={() => setView(id)}>{label}</button>)}</nav>
    {view === "quiz" && data && <UniversityMidterm key={data.profile.email} userEmail={data.profile.email} />}
    {view === "competition" && data?.profile.learnerType === "university" && <UniversityMockExam />}
    {view === "python" && data && <PythonLab />}
    {error && <p className="workspace-message" role="alert">{error}</p>}
    {!data && !error && <section className="panel" role="status">학습 기록을 불러오는 중입니다.</section>}
    {!data && error && <section className="panel"><button type="button" className="ghost" onClick={() => void refresh().then(() => setError("")).catch((caught) => setError(caught.message))}>다시 불러오기</button></section>}
    {view === "home" && data && <UniversityHome learnerType={data.profile.learnerType} courses={courses} exams={exams} mistakes={mistakes} onNavigate={setView} onOpenMap={(courseId) => { setMapCourseId(courseId); setView("map"); }} />}
    {view === "map" && data && <UniversityStudyMap courses={courses} exams={exams} mistakes={mistakes} onNavigate={setView} selectedCourseId={mapCourseId} onSelectCourse={setMapCourseId} />}
    {view === "courses" && data && <section className="panel"><h2>내 과목</h2><p>이번 학기 과목을 등록하세요. 시험과 오답이 학습 지도에 연결됩니다.</p><form className="form university-form" onSubmit={(event) => void save(event, { kind: "course", title: courseTitle, semester }, () => { setCourseTitle(""); setSemester(""); })}><label>과목명<input value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} placeholder="예: 미적분학Ⅰ" required /></label><label>학기<input value={semester} onChange={(event) => setSemester(event.target.value)} placeholder="예: 2026년 2학기" /></label><button className="primary" disabled={busy}>과목 등록</button></form><div className="university-list">{courses.map((course) => <div className="row" key={course.id}><strong>{course.title}</strong><span>{course.semester || "학기 미지정"} · 오답 {mistakes.filter((item) => item.course_id === course.id).length}개</span></div>)}{!courses.length && <p>아직 등록한 과목이 없습니다.</p>}</div></section>}
    {view === "exams" && data && <section className="panel"><h2>시험 준비</h2><p>과목별 시험 날짜를 등록해두면 홈에서 가까운 일정부터 확인할 수 있습니다.</p><form className="form university-form" onSubmit={(event) => void save(event, { kind: "exam", courseId: examCourse, title: examTitle, examDate }, () => { setExamTitle(""); setExamDate(""); })}><label>과목<select value={examCourse} onChange={(event) => setExamCourse(event.target.value)} required><option value="">과목 선택</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label>시험명<input value={examTitle} onChange={(event) => setExamTitle(event.target.value)} placeholder="예: 중간고사" required /></label><label>시험 날짜<input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} required /></label><button className="primary" disabled={busy || !courses.length}>시험 등록</button></form><div className="university-list">{exams.map((exam) => <div className="row" key={exam.id}><strong>{courseName(exam.course_id)} · {exam.title}</strong><span>{exam.exam_date}</span></div>)}{!exams.length && <p>아직 등록한 시험이 없습니다.</p>}</div></section>}
    {view === "mistakes" && data && <section className="panel"><h2>내 오답 복습</h2><p>문제번호와 헷갈린 이유를 남기고 다시 풀었다면 복습 완료로 표시하세요.</p><form className="form university-form" onSubmit={(event) => void save(event, { kind: "mistake", courseId: mistakeCourse, problemLabel, memo }, () => { setProblemLabel(""); setMemo(""); })}><label>과목<select value={mistakeCourse} onChange={(event) => setMistakeCourse(event.target.value)} required><option value="">과목 선택</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label>문제번호·제목<input value={problemLabel} onChange={(event) => setProblemLabel(event.target.value)} placeholder="예: 3주차 과제 5번" required /></label><label>틀린 이유·복습 메모<textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="어떤 개념이 헷갈렸나요?" /></label><button className="primary" disabled={busy || !courses.length}>오답 저장</button></form><div className="university-list">{mistakes.map((item) => <div className="row university-mistake" key={item.id}><div><strong>{courseName(item.course_id)} · {item.problem_label}</strong><span>{item.memo || "메모 없음"}</span></div><button type="button" className={item.reviewed ? "reviewed" : ""} disabled={busy} onClick={() => void toggleReview(item)}>{item.reviewed ? "복습 완료 ✓" : "복습하기"}</button></div>)}{!mistakes.length && <p>아직 작성한 오답이 없습니다.</p>}</div></section>}
    {view === "helper" && data && <section className="panel university-helper"><span className="badge">결결이 · 학습 도우미 미리보기</span><h2>어떤 부분이 가장 막히나요?</h2><p>대학생용 결결이 상담 화면을 준비 중입니다. 현재는 실제 AI 답변이 연결되지 않았으며, 과목·시험·오답 기록은 다른 메뉴에서 이용할 수 있습니다.</p><div className="university-prompts"><span>시험 계획 세우기</span><span>오답 복습하기</span><span>공부 습관 점검하기</span></div></section>}
  </main>;
}

