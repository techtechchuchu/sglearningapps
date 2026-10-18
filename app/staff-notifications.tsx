"use client";

import { useEffect, useState } from "react";

type Row = Record<string, any>;
type Question = { id: number; student_name: string; class_name: string; status: string; created_at: string };

export default function StaffNotifications({ teacher, roster, users, resetRequests, navigate }: {
  teacher: string; roster: Row[]; users: Row[]; resetRequests: Row[];
  navigate: (tab: "admin" | "reset" | "questions", adminSection?: "members") => void;
}) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [academyCount, setAcademyCount] = useState(0);
  const [academyError, setAcademyError] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const admin = teacher === "전체 관리자";

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const response = await fetch("/api/questions", { cache: "no-store" });
        if (!response.ok) throw new Error("질문 조회 실패");
        const result = await response.json();
        if (alive) { setQuestions(Array.isArray(result.questions) ? result.questions : []); setLoadError(false); }
      } catch { if (alive) setLoadError(true); }
    }
    async function loadAcademy() { try { const r = await fetch("/api/academy/requests", {cache:"no-store"}); const v = await r.json(); if (!r.ok) throw new Error(); if (alive) { setAcademyCount(v.requests.length); setAcademyError(false); } } catch { if (alive) setAcademyError(true); } }
    void loadAcademy();
    const academyTimer = window.setInterval(() => void loadAcademy(), 60000);
    const onReviewed = () => void loadAcademy();
    window.addEventListener("academy-reviewed", onReviewed);
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; window.clearInterval(timer); window.clearInterval(academyTimer); window.removeEventListener("academy-reviewed", onReviewed); document.removeEventListener("visibilitychange", onVisible); };
  }, [teacher]);

  const assignedNames = new Set(roster.filter((row) => row.enrollment_status !== "퇴원").map((row) => String(row.student_name || "")));
  const unassigned = admin ? users.filter((row) => !assignedNames.has(String(row.username || ""))) : [];
  const unanswered = questions.filter((row) => row.status === "open");
  const count = unassigned.length + resetRequests.length + unanswered.length + academyCount;
  function go(tab: "admin" | "reset" | "questions", section?: "members") { setOpen(false); navigate(tab, section); }

  return <div className="staff-notifications">
    <button type="button" className="staff-notification-trigger" aria-label={`알림 ${count}건`} aria-expanded={open} aria-controls="staff-notification-panel" onClick={() => setOpen((value) => !value)}>🔔 알림{count > 0 && <span className="staff-notification-count">{count > 99 ? "99+" : count}</span>}</button>
    {open && <section id="staff-notification-panel" className="staff-notification-panel" aria-label="확인이 필요한 알림">
      <div className="staff-notification-head"><strong>확인이 필요한 알림</strong><button type="button" aria-label="알림 닫기" onClick={() => setOpen(false)}>×</button></div>
      {count === 0 && !loadError && <p>지금 확인할 알림이 없습니다.</p>}
      {academyCount > 0 && <button type="button" className="staff-notification-item" onClick={() => { setOpen(false); const panel = document.getElementById("academy-review"); if (panel instanceof HTMLDetailsElement) { panel.open = true; panel.scrollIntoView({behavior:"smooth"}); } }}><strong>🏫 학원 연결 승인 대기 {academyCount}건</strong><span>학생 신원·명단 확인 후 승인</span></button>}
      {academyError && <p role="status">학원 연결 알림을 불러오지 못했습니다.</p>}
      {admin && unassigned.length > 0 && <button type="button" className="staff-notification-item" onClick={() => go("admin", "members")}><strong>🆕 미배정 신규 회원 {unassigned.length}명</strong><span>{unassigned.slice(0, 3).map((row) => row.username).join(", ")}{unassigned.length > 3 ? " 외" : ""} · 회원 목록에서 배정</span></button>}
      {resetRequests.length > 0 && <button type="button" className="staff-notification-item" onClick={() => go("reset")}><strong>🔑 비밀번호 재설정 요청 {resetRequests.length}건</strong><span>비밀번호 관리에서 확인</span></button>}
      {unanswered.length > 0 && <><div className="staff-notification-item"><strong>💬 답변 대기 질문 {unanswered.length}건</strong><span>질문을 열면 질문함에서 학생 정보를 확인하고 답변할 수 있습니다.</span></div>{unanswered.slice(0, 5).map((row) => <button type="button" className="staff-notification-item" key={row.id} onClick={() => go("questions")}><strong>{row.student_name} · {row.class_name}</strong><span>새 질문 · {new Date(row.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · 학생 정보 보기</span></button>)}</>}
      {loadError && <p role="status">질문 알림을 불러오지 못했습니다. 잠시 후 다시 확인해주세요.</p>}
      <small>알림은 처리 상태를 기준으로 자동 갱신됩니다.</small>
    </section>}
  </div>;
}
