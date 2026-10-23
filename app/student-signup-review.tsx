"use client";

import { useCallback, useEffect, useState } from "react";

type RequestRow = { username: string; login_id: string; grade: string; email: string; phone: string; created_at: string };
type RosterRow = { student_name?: string; grade?: string; teacher_name?: string; class_name?: string; school_name?: string; enrollment_status?: string };

export default function StudentSignupReview({ roster, refresh }: { roster: RosterRow[]; refresh: () => Promise<void> }) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/student-signups", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "가입 신청을 불러오지 못했습니다.");
      setRequests(result.requests || []);
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "가입 신청을 불러오지 못했습니다."); }
  }, []);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 60000); return () => clearInterval(timer); }, [load]);

  async function decide(row: RequestRow, approve: boolean) {
    const action = approve ? "승인" : "반려";
    if (!window.confirm(`${row.username} 학생의 가입을 ${action}할까요?`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/student-signups", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: row.username, approve }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "처리하지 못했습니다.");
      await Promise.all([load(), refresh()]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "처리하지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <details className="panel academy-review"><summary>🔔 학생 가입 승인 대기 · {requests.length}건</summary>
    <p>가입코드만으로는 로그인할 수 없습니다. 재원 명단의 이름·학년을 확인하고 승인해주세요.</p>
    {error && <p role="alert">{error}</p>}
    {requests.map(row => {
      const matches = roster.filter(item => item.student_name === row.username && item.enrollment_status !== "퇴원" && (!item.grade || item.grade === row.grade));
      return <article className="academy-review-item" key={row.username}>
        <strong>{row.username} · {row.grade}</strong>
        <span>신청 {new Date(row.created_at).toLocaleString("ko-KR")}</span>
        <p>아이디 {row.login_id} · 이메일 {row.email} · 휴대전화 {row.phone}</p>
        {matches.length ? matches.map((item, index) => <p key={`${item.teacher_name}-${item.class_name}-${index}`}>명단: {item.school_name} · {item.teacher_name} · {item.class_name}</p>) : <p>일치하는 재원 명단이 없습니다. 승인하려면 먼저 신규생 명단에 등록해주세요.</p>}
        <div className="actions"><button type="button" className="primary" disabled={busy || !matches.length} onClick={() => void decide(row, true)}>명단 확인 후 승인</button><button type="button" className="ghost" disabled={busy} onClick={() => void decide(row, false)}>반려</button></div>
      </article>;
    })}
    {!requests.length && !error && <p>대기 중인 학생 가입 신청이 없습니다.</p>}
    <button type="button" className="ghost" disabled={busy} onClick={() => void load()}>새로고침</button>
  </details>;
}
