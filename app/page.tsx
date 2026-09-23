"use client";

import { FormEvent, useState } from "react";

type StudentData = {
  roster: any[];
  wrongAnswers: any[];
  wrongNoteFiles: any[];
  notices: any[];
};

type TeacherData = {
  roster: any[];
  wrongAnswers: any[];
  wrongNoteFiles: any[];
  reports: any[];
};

const teachers = ["이주백.T", "박병민.T", "노대근.T", "전체 관리자"];

export default function Home() {
  const [mode, setMode] = useState<"student" | "teacher">("student");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [teacher, setTeacher] = useState("이주백.T");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [teacherData, setTeacherData] = useState<TeacherData | null>(null);
  const [sessionLabel, setSessionLabel] = useState("");

  async function loginStudent(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const auth = await fetch("/api/auth/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, password }),
      });
      const authJson = await auth.json();
      if (!auth.ok) throw new Error(authJson.message || "로그인 실패");

      const response = await fetch(`/api/dashboard/student?username=${encodeURIComponent(name.trim())}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "데이터 조회 실패");
      setStudentData(data);
      setTeacherData(null);
      setSessionLabel(`${name.trim()} 학생`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function loginTeacher(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const auth = await fetch("/api/auth/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher, password }),
      });
      const authJson = await auth.json();
      if (!auth.ok) throw new Error(authJson.message || "로그인 실패");

      const response = await fetch(`/api/dashboard/teacher?teacher=${encodeURIComponent(teacher)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "데이터 조회 실패");
      setTeacherData(data);
      setStudentData(null);
      setSessionLabel(teacher);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setStudentData(null);
    setTeacherData(null);
    setSessionLabel("");
    setPassword("");
    setMessage("");
  }

  if (studentData) {
    const books = Array.from(new Set(studentData.roster.map((row) => row.book_name).filter(Boolean)));
    const teachersForStudent = Array.from(new Set(studentData.roster.map((row) => row.teacher_name).filter(Boolean)));
    return (
      <main className="shell dashboard-shell">
        <section className="topbar"><div><span className="badge">SG 고등관</span><h1>{sessionLabel}</h1></div><button className="ghost" onClick={logout}>로그아웃</button></section>
        <section className="metrics">
          <article><b>{studentData.wrongAnswers.length}</b><span>누적 오답</span></article>
          <article><b>{studentData.wrongNoteFiles.length}</b><span>저장된 오답노트 PDF</span></article>
          <article><b>{books.length}</b><span>등록 교재</span></article>
          <article><b>{teachersForStudent.length}</b><span>담당 선생님</span></article>
        </section>
        <section className="grid2">
          <article className="panel"><h2>📚 내 수업 정보</h2>{studentData.roster.length ? studentData.roster.map((row, i) => <div className="row" key={i}><strong>{row.class_name || "반 미지정"}</strong><span>{row.teacher_name} · {row.book_name || "교재 미지정"}</span></div>) : <p>등록된 반 정보가 없습니다.</p>}</article>
          <article className="panel"><h2>📄 내 오답노트 기록</h2>{studentData.wrongNoteFiles.length ? studentData.wrongNoteFiles.slice(0, 20).map((row, i) => <div className="row" key={i}><strong>{row.round_number ? `${row.round_number}회` : "회차 미지정"} {row.subject_name || ""}</strong><span>{row.source_school || ""} · {row.original_filename}</span></div>) : <p>아직 업로드된 PDF가 없습니다.</p>}</article>
        </section>
        <section className="panel"><h2>📝 최근 오답 제출</h2>{studentData.wrongAnswers.length ? studentData.wrongAnswers.slice(0, 50).map((row, i) => <div className="row" key={i}><strong>{row.unit || row.book || "오답"} · {row.problem || row.problem_number || "문항"}</strong><span>{row.memo || ""} {row.created_at ? `· ${new Date(row.created_at).toLocaleString("ko-KR")}` : ""}</span></div>) : <p>제출 기록이 없습니다.</p>}</section>
      </main>
    );
  }

  if (teacherData) {
    const active = teacherData.roster.filter((row) => !row.enrollment_status || row.enrollment_status === "재원");
    return (
      <main className="shell dashboard-shell">
        <section className="topbar"><div><span className="badge">SG 고등관 선생님 관리</span><h1>{sessionLabel}</h1></div><button className="ghost" onClick={logout}>로그아웃</button></section>
        <section className="metrics">
          <article><b>{active.length}</b><span>재원 명단</span></article>
          <article><b>{teacherData.wrongAnswers.length}</b><span>조회된 오답</span></article>
          <article><b>{teacherData.wrongNoteFiles.length}</b><span>오답노트 PDF</span></article>
          <article><b>{teacherData.reports.length}</b><span>제출 보고서</span></article>
        </section>
        <section className="grid2">
          <article className="panel"><h2>👥 학생 명단</h2>{active.slice(0, 100).map((row, i) => <div className="row" key={i}><strong>{row.student_name}</strong><span>{row.class_name || "-"} · {row.school_name || "-"} · {row.book_name || "-"}</span></div>)}</article>
          <article className="panel"><h2>📦 최근 오답노트 PDF</h2>{teacherData.wrongNoteFiles.slice(0, 50).map((row, i) => <div className="row" key={i}><strong>{row.student_name} {row.round_number ? `· ${row.round_number}회` : ""}</strong><span>{row.original_filename} {row.uploaded_at ? `· ${new Date(row.uploaded_at).toLocaleString("ko-KR")}` : ""}</span></div>)}</article>
        </section>
        <section className="panel"><h2>📝 최근 오답</h2>{teacherData.wrongAnswers.slice(0, 100).map((row, i) => <div className="row" key={i}><strong>{row.username} · {row.unit || row.book || "오답"} · {row.problem || row.problem_number || "문항"}</strong><span>{row.memo || ""}</span></div>)}</section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="login-card">
        <div className="brand"><span className="badge">SG 고등관</span><h1>오답노트</h1><p>기존 Streamlit 데이터는 그대로 유지하고 같은 Supabase 데이터를 사용하는 Vercel 버전입니다.</p></div>
        <div className="tabs"><button className={mode === "student" ? "active" : ""} onClick={() => setMode("student")}>👩‍🎓 학생</button><button className={mode === "teacher" ? "active" : ""} onClick={() => setMode("teacher")}>👨‍🏫 선생님</button></div>
        {mode === "student" ? (
          <form onSubmit={loginStudent} className="form"><label>학생<input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" /></label><label>비밀번호<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><button className="primary" disabled={loading}>{loading ? "확인 중..." : "로그인"}</button></form>
        ) : (
          <form onSubmit={loginTeacher} className="form"><label>담당 선생님<select value={teacher} onChange={(e) => setTeacher(e.target.value)}>{teachers.map((item) => <option key={item}>{item}</option>)}</select></label><label>공용 비밀번호<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><button className="primary" disabled={loading}>{loading ? "확인 중..." : "로그인"}</button></form>
        )}
        {message && <div className="alert">{message}</div>}
        <p className="safe-note">기존 Streamlit 저장소와 기존 Supabase 데이터는 삭제하거나 이동하지 않습니다.</p>
      </section>
    </main>
  );
}
