"use client";

import { FormEvent, useEffect, useState } from "react";
import StudentWorkspace from "./student-workspace";
import TeacherWorkspace, { type TeacherData } from "./teacher-workspace";
import BrandLockup from "./brand-lockup";
import UniversityWorkspace from "./university-workspace";
import { IndependentSignup, KakaoButton, MemberGate } from "./member-account";

type StudentData = {
  roster: any[];
  wrongAnswers: any[];
  wrongNoteFiles: any[];
  notices: any[];
  mustChangePassword?: boolean;
  grade?: string;
};

const teachers = ["이주백.T", "박병민.T", "노대근.T", "전체 관리자"];

async function fetchForRestore(url: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.status < 500 || attempt === 1) return response;
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
  throw new Error("서버에 연결하지 못했습니다.");
}

export default function Home() {
  const [mode, setMode] = useState<"student" | "teacher" | "university">("student");
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
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState("");
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [universityLoggedIn, setUniversityLoggedIn] = useState(false);
  const [universityEmail, setUniversityEmail] = useState("");
  const [universityName, setUniversityName] = useState("");
  const [universitySignup, setUniversitySignup] = useState(false);

  useEffect(() => {
    let active = true;
    function syncScreenFromHash() {
      const hash = window.location.hash;
      if (["#home", "#choose", "#personal", "#academy", "#company"].includes(hash)) {
        window.location.replace(`/home${hash === "#home" ? "" : hash}`);
        return;
      }
      if (hash === "#login-teacher") setMode("teacher");
      if (hash === "#login-student" || hash.startsWith("#attendance=")) setMode("student");
      if (hash === "#login-university") setMode("university");
    }
    syncScreenFromHash();
    const authMessage = new URLSearchParams(window.location.search).get("auth_message");
    if (authMessage) { setMessage(authMessage); window.history.replaceState(null, "", window.location.pathname + window.location.hash); }
    window.addEventListener("hashchange", syncScreenFromHash);
    async function restore() {
      try {
        const sessionResponse = await fetchForRestore("/api/auth/session");
        if (!sessionResponse.ok) throw new Error("로그인 상태를 확인하지 못했습니다.");
        const session = await sessionResponse.json();
        if (!active || !session.authenticated) return;
        if ((session.role === "university" || session.role === "member")) { setMode("university"); setUniversityLoggedIn(true); return; }
        const role = session.role === "student" ? "student" : "teacher";
        const response = await fetchForRestore(`/api/dashboard/${role}`);
        const data = await response.json();
        if (!active) return;
        if (response.status === 401) { setMode(role); setMessage("로그인 시간이 만료되었습니다. 다시 로그인해주세요."); return; }
        if (!response.ok) throw new Error(data.message || "학습 데이터를 불러오지 못했습니다.");
        setMode(role); setSessionLabel(role === "student" ? `${session.name} 학생` : session.name);
        if (role === "student") setStudentData(data); else setTeacherData(data);
      } catch (error) {
        if (active) setRestoreError(error instanceof Error ? error.message : "서버 연결을 확인해주세요.");
      } finally {
        if (active) setRestoring(false);
      }
    }
    void restore();
    return () => { active = false; window.removeEventListener("hashchange", syncScreenFromHash); };
  }, [restoreAttempt]);

  function retryRestore() {
    setRestoreError("");
    setRestoring(true);
    setRestoreAttempt((value) => value + 1);
  }

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

  async function universityAuth(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/auth/university", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: universitySignup ? "signup" : "login", email: universityEmail, password, name: universityName }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "계정을 확인하지 못했습니다.");
      if (universitySignup) { setUniversitySignup(false); setPassword(""); setMessage(result.message); }
      else { setUniversityLoggedIn(true); setPassword(""); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "요청을 처리하지 못했습니다."); }
    finally { setLoading(false); }
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
    const nextMode = mode;
    void fetch("/api/auth/logout", { method: "POST" });
    setStudentData(null);
    setTeacherData(null);
    setUniversityLoggedIn(false);
    setSessionLabel("");
    setPassword("");
    setMessage("");
    window.location.hash = `login-${nextMode}`;
  }

  if (studentData) return <StudentWorkspace name={sessionLabel.replace(/ 학생$/, "")} data={studentData} refresh={refreshStudent} logout={logout} />;

  if (teacherData) return <TeacherWorkspace teacher={sessionLabel} data={teacherData} refresh={refreshTeacher} logout={logout} />;

  if (universityLoggedIn) return <MemberGate logout={logout}><UniversityWorkspace logout={logout} /></MemberGate>;

  if (restoring) return <main className="shell"><section className="login-card" role="status"><div className="brand"><BrandLockup compact solo /><h1>로그인 상태 확인 중</h1><p>잠시만 기다려주세요.</p></div></section></main>;

  if (restoreError) return <main className="shell"><section className="login-card" role="alert"><div className="brand"><BrandLockup compact solo /><h1>연결을 다시 확인해주세요</h1><p>일시적인 연결 문제일 수 있습니다. 로그인 정보는 삭제하지 않았습니다.</p></div><p className="alert">{restoreError}</p><div className="learning-actions"><button type="button" className="primary" onClick={retryRestore}>다시 연결</button><button type="button" className="ghost" onClick={() => { setRestoreError(""); }}>로그인 화면</button></div></section></main>;

  return (
    <main className="shell">
      <section className="login-card">
        <div className="brand"><BrandLockup compact solo /><h1>학습 노트 시작하기</h1><p>{mode === "university" ? "대학생을 위한 나만의 과목·시험·오답 기록을 시작하세요." : "기존 학원 계정으로 로그인해 오답을 기록하고 수업 현황을 확인하세요."}</p></div>
        <div className="tabs login-role-tabs"><button type="button" className={mode === "student" ? "active" : ""} onClick={() => { setMode("student"); setMessage(""); window.location.hash = "login-student"; }}>학생·일반</button><button type="button" className={mode === "teacher" ? "active" : ""} onClick={() => { setMode("teacher"); setMessage(""); window.location.hash = "login-teacher"; }}>선생님·관리자</button><button type="button" className={mode === "university" ? "active" : ""} onClick={() => { setMode("university"); setMessage(""); window.location.hash = "login-university"; }}>대학생</button></div>
        {mode === "student" ? (<>
          <div className="tabs account-tabs"><button className={studentAuthTab === "login" ? "active" : ""} onClick={() => { setStudentAuthTab("login"); setMessage(""); }}>로그인</button><button className={studentAuthTab === "signup" ? "active" : ""} onClick={() => { setStudentAuthTab("signup"); setMessage(""); }}>회원가입</button><button className={studentAuthTab === "reset" ? "active" : ""} onClick={() => { setStudentAuthTab("reset"); setMessage(""); }}>비밀번호 재설정</button></div>
          {studentAuthTab === "signup" ? <IndependentSignup /> : <form onSubmit={studentAuthTab === "login" ? loginStudent : studentAccountAction} className="form"><label>학생 이름<input value={name} onChange={e => setName(e.target.value)} autoComplete="username" required /></label>{studentAuthTab === "login" && <label>비밀번호<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>}<button className="primary" disabled={loading}>{loading ? "확인 중…" : studentAuthTab === "login" ? "기존 학원 계정 로그인" : "재설정 요청"}</button></form>}
          {studentAuthTab === "login" && <KakaoButton />}
          {studentAuthTab === "reset" && <p className="safe-note">담당 선생님이 임시 비밀번호를 안내합니다.</p>}
        </>) : mode === "teacher" ? (
          <form onSubmit={loginTeacher} className="form"><label>담당 선생님<select value={teacher} onChange={(e) => setTeacher(e.target.value)}>{teachers.map((item) => <option key={item}>{item}</option>)}</select></label><label>공용 비밀번호<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><button className="primary" disabled={loading}>{loading ? "확인 중..." : "로그인"}</button></form>
        ) : (<>
          <div className="tabs account-tabs"><button type="button" className={!universitySignup ? "active" : ""} onClick={() => { setUniversitySignup(false); setMessage(""); }}>로그인</button><button type="button" className={universitySignup ? "active" : ""} onClick={() => { setUniversitySignup(true); setMessage(""); }}>대학생 회원가입</button></div>
          {universitySignup ? <IndependentSignup /> : <form onSubmit={universityAuth} className="form">{universitySignup && <label>이름<input value={universityName} onChange={(event) => setUniversityName(event.target.value)} autoComplete="name" required /></label>}<label>이메일<input type="email" value={universityEmail} onChange={(event) => setUniversityEmail(event.target.value)} autoComplete="email" required /></label><label>비밀번호<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete={universitySignup ? "new-password" : "current-password"} required /></label><button className="primary" disabled={loading}>{loading ? "확인 중..." : universitySignup ? "가입하기" : "대학생으로 로그인"}</button></form>}
          <p className="safe-note">학원 계정과 분리된 대학생용 공간입니다. 과목·시험·오답 기록부터 이용할 수 있습니다.</p>
        </>)}
        {message && <div className="alert">{message}</div>}
        {mode !== "university" && <p className="safe-note">SG 오답노트 계정으로 로그인하세요.</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" className="ghost" onClick={() => { window.location.assign("/home"); }}>공식 홈페이지로 이동 ↗</button>
          <button type="button" className="ghost" onClick={() => { setMode("university"); setMessage(""); window.location.hash = "login-university"; }}>대학생을 위한 스터디결 →</button>
        </div>
        <nav aria-label="서비스 정책" style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: 20, fontSize: 13 }}><a href="/terms">이용약관</a><a href="/privacy">개인정보 처리방침</a><a href="/content-policy">자체교재·PDF 이용 및 보관 원칙</a></nav>
      </section>
    </main>
  );
}

