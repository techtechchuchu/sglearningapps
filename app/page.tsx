"use client";

import { FormEvent, useEffect, useState } from "react";
import Landing from "./landing";
import StudentWorkspace from "./student-workspace";
import TeacherWorkspace, { type TeacherData } from "./teacher-workspace";
import BrandLockup from "./brand-lockup";

type StudentData = {
  roster: any[];
  wrongAnswers: any[];
  wrongNoteFiles: any[];
  notices: any[];
  mustChangePassword?: boolean;
  grade?: string;
};

const teachers = ["이주백.T", "박병민.T", "노대근.T", "전체 관리자"];

export default function Home() {
  const [showLogin, setShowLogin] = useState(false);
  const [mode, setMode] = useState<"student" | "teacher">("student");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [teacher, setTeacher] = useState("이주백.T");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [teacherData, setTeacherData] = useState<TeacherData | null>(null);
  const [sessionLabel, setSessionLabel] = useState("");
  const [studentAuthTab, setStudentAuthTab] = useState<"login" | "signup" | "reset">("login");
  const [signupGrade, setSignupGrade] = useState("고1");
  const [signupCode, setSignupCode] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.json()).then(async (session) => {
      if (!active || !session.authenticated) return;
      const role = session.role === "student" ? "student" : "teacher";
      const response = await fetch(`/api/dashboard/${role}`, { cache: "no-store" });
      const data = await response.json();
      if (!active) return;
      if (!response.ok) { setShowLogin(true); setMode(role); setMessage(data.message || "데이터를 불러오지 못했습니다."); return; }
      setShowLogin(true); setMode(role); setSessionLabel(role === "student" ? `${session.name} 학생` : session.name);
      if (role === "student") setStudentData(data); else setTeacherData(data);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  async function refreshStudent() {
    const response = await fetch("/api/dashboard/student", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "데이터를 불러오지 못했습니다.");
    setStudentData(data);
  }

  async function refreshTeacher() {
    const response = await fetch("/api/dashboard/teacher", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "데이터를 불러오지 못했습니다.");
    setTeacherData(data);
  }

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
      const authJson = await auth.json().catch(() => ({ message: `로그인 서버 오류 (${auth.status})` }));
      if (!auth.ok) throw new Error(authJson.message || "로그인 실패");

      const response = await fetch("/api/dashboard/student", { cache: "no-store" });
      const data = await response.json().catch(() => ({ message: `데이터 서버 오류 (${response.status})` }));
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

      const response = await fetch("/api/dashboard/teacher", { cache: "no-store" });
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

  async function studentAccountAction(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setMessage("");
    try {
      if (studentAuthTab === "signup" && password !== confirmPassword) throw new Error("비밀번호 확인이 일치하지 않습니다.");
      const url = studentAuthTab === "signup" ? "/api/auth/student/signup" : "/api/auth/student/reset-request";
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: name, password, grade: signupGrade, signupCode }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "요청을 처리하지 못했습니다.");
      setMessage(result.message);
      if (studentAuthTab === "signup") { setStudentAuthTab("login"); setPassword(""); setConfirmPassword(""); setSignupCode(""); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "오류가 발생했습니다."); }
    finally { setLoading(false); }
  }

  function logout() {
    void fetch("/api/auth/logout", { method: "POST" });
    setStudentData(null);
    setTeacherData(null);
    setSessionLabel("");
    setPassword("");
    setMessage("");
    setShowLogin(false);
  }

  if (studentData) return <StudentWorkspace name={sessionLabel.replace(/ 학생$/, "")} data={studentData} refresh={refreshStudent} logout={logout} />;

  if (teacherData) return <TeacherWorkspace teacher={sessionLabel} data={teacherData} refresh={refreshTeacher} logout={logout} />;

  if (!showLogin) return <Landing onLogin={(selectedMode) => { setMode(selectedMode); setMessage(""); setPassword(""); setShowLogin(true); window.scrollTo(0, 0); }} />;

  return (
    <main className="shell">
      <section className="login-card">
        <button className="ghost" onClick={() => setShowLogin(false)}>홈으로</button>
        <div className="brand"><BrandLockup compact /><h1>학습 노트 시작하기</h1><p>기존 학원 계정으로 로그인해 오답을 기록하고 수업 현황을 확인하세요.</p></div>
        <div className="tabs"><button className={mode === "student" ? "active" : ""} onClick={() => setMode("student")}>👩‍🎓 학생</button><button className={mode === "teacher" ? "active" : ""} onClick={() => setMode("teacher")}>👨‍🏫 선생님·관리자</button></div>
        {mode === "student" ? (<>
          <div className="tabs account-tabs"><button className={studentAuthTab === "login" ? "active" : ""} onClick={() => { setStudentAuthTab("login"); setMessage(""); }}>로그인</button><button className={studentAuthTab === "signup" ? "active" : ""} onClick={() => { setStudentAuthTab("signup"); setMessage(""); }}>회원가입</button><button className={studentAuthTab === "reset" ? "active" : ""} onClick={() => { setStudentAuthTab("reset"); setMessage(""); }}>비밀번호 재설정</button></div>
          <form onSubmit={studentAuthTab === "login" ? loginStudent : studentAccountAction} className="form"><label>학생 이름<input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" required /></label>{studentAuthTab !== "reset" && <label>비밀번호<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={studentAuthTab === "signup" ? 4 : undefined} required /></label>}{studentAuthTab === "signup" && <><label>비밀번호 확인<input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={4} required /></label><label>학년<select value={signupGrade} onChange={(e) => setSignupGrade(e.target.value)}>{["중3", "고1", "고2", "고3"].map((grade) => <option key={grade}>{grade}</option>)}</select></label><label>학원 가입 코드<input type="password" value={signupCode} onChange={(e) => setSignupCode(e.target.value)} required /></label></>}<button className="primary" disabled={loading}>{loading ? "확인 중..." : studentAuthTab === "login" ? "로그인" : studentAuthTab === "signup" ? "회원가입" : "재설정 요청"}</button></form>
          {studentAuthTab === "reset" && <p className="safe-note">담당 선생님이 임시 비밀번호를 안내합니다.</p>}
        </>) : (
          <form onSubmit={loginTeacher} className="form"><label>담당 선생님<select value={teacher} onChange={(e) => setTeacher(e.target.value)}>{teachers.map((item) => <option key={item}>{item}</option>)}</select></label><label>공용 비밀번호<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><button className="primary" disabled={loading}>{loading ? "확인 중..." : "로그인"}</button></form>
        )}
        {message && <div className="alert">{message}</div>}
        <p className="safe-note">SG 오답노트 계정으로 로그인하세요.</p>
      </section>
    </main>
  );
}
