"use client";

import { useState } from "react";
import { splitRosterBooks } from "../lib/wrong-answers";
import styles from "./teacher-student-roster.module.css";

type Row = Record<string, any>;
type StatusFilter = "all" | "complete" | "unregistered" | "other";
const PAGE_SIZE = 20;

function signupStatus(account?: Row): { label: string; category: Exclude<StatusFilter, "all"> } {
  if (!account) return { label: "미가입", category: "unregistered" };
  if (account.withdrawn_at) return { label: "탈퇴 회원", category: "other" };
  if (account.signup_status === "pending") return { label: "승인 대기", category: "other" };
  if (account.signup_status === "rejected") return { label: "가입 반려", category: "other" };
  return { label: "가입 완료", category: "complete" };
}

export default function TeacherStudentRoster({ roster, users, sharedAccount }: {
  roster: Row[];
  users: Row[];
  sharedAccount?: Row | null;
}) {
  const [selectedClass, setSelectedClass] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const activeRoster = roster.filter((row) => (!row.enrollment_status || row.enrollment_status === "재원") && String(row.student_name || "").trim());
  const classes = [...new Set(activeRoster.map((row) => String(row.class_name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  const accounts = new Map(users.map((user) => [String(user.username || "").trim(), user]));
  const classRows = activeRoster.filter((row) => !selectedClass || row.class_name === selectedClass);
  const uniqueStudents = new Map<string, ReturnType<typeof signupStatus>>();
  for (const row of classRows) {
    const name = String(row.student_name || "").trim();
    if (!uniqueStudents.has(name)) uniqueStudents.set(name, signupStatus(accounts.get(name)));
  }
  const counts = { all: uniqueStudents.size, complete: 0, unregistered: 0, other: 0 };
  for (const status of uniqueStudents.values()) counts[status.category] += 1;

  const query = search.trim().toLocaleLowerCase("ko");
  const results = classRows
    .filter((row) => String(row.student_name || "").toLocaleLowerCase("ko").includes(query))
    .filter((row) => statusFilter === "all" || signupStatus(accounts.get(String(row.student_name || "").trim())).category === statusFilter)
    .sort((a, b) => String(a.class_name || "").localeCompare(String(b.class_name || ""), "ko") || String(a.student_name || "").localeCompare(String(b.student_name || ""), "ko"));
  const visibleRows = results.slice(0, visibleCount);

  return <section className={`panel ${styles.panel}`}>
    <div className={styles.heading}>
      <div><h2>담당 학생 명단·가입 현황</h2><p>반과 이름으로 찾고, 학생을 누르면 교재 정보를 볼 수 있습니다.</p></div>
      <span className={styles.resultCount} aria-live="polite">검색 결과 {results.length}건</span>
    </div>
    <div className={styles.filters}>
      <label>반 선택
        <select value={selectedClass} onChange={(event) => { setSelectedClass(event.target.value); setVisibleCount(PAGE_SIZE); }}>
          <option value="">전체 반</option>
          {classes.map((className) => <option key={className} value={className}>{className}</option>)}
        </select>
      </label>
      <label>학생 이름 검색
        <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="이름을 입력하세요" />
      </label>
    </div>
    <div className={styles.statusFilters} role="group" aria-label="가입 상태 필터">
      {([
        ["all", "전체", counts.all],
        ["complete", "가입 완료", counts.complete],
        ["unregistered", "미가입만 보기", counts.unregistered],
        ["other", "승인 대기·기타", counts.other],
      ] as const).map(([value, label, count]) => <button type="button" key={value} className={statusFilter === value ? styles.selected : ""} aria-pressed={statusFilter === value} onClick={() => { setStatusFilter(value); setVisibleCount(PAGE_SIZE); }}>{label} <span>{count}</span></button>)}
    </div>
    <div className={styles.list} aria-live="polite">
      {visibleRows.length ? visibleRows.map((row, index) => {
        const name = String(row.student_name || "").trim();
        const status = signupStatus(accounts.get(name));
        return <details className={styles.item} key={row.id ?? `${row.class_name}-${name}-${index}`}>
          <summary><span className={styles.studentName}>{name}</span><span className={styles.className}>{row.class_name || "반 미배정"}</span><span className={`${styles.badge} ${styles[status.category]}`}>{status.label}</span></summary>
          <div className={styles.detail}><span>학교·학년: {row.school_name || "미등록"} · {row.grade || "미등록"}</span><span>교재: {splitRosterBooks(row.book_name).join(", ") || "미등록"}</span></div>
        </details>;
      }) : <p className={styles.empty}>조건에 맞는 학생이 없습니다.</p>}
    </div>
    {results.length > visibleCount && <button type="button" className={styles.more} onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>20건 더 보기 <span>({visibleCount}/{results.length}건 표시)</span></button>}
    {sharedAccount && <details className={styles.shared}><summary>공용 확인 계정</summary><p>{sharedAccount.username} · {sharedAccount.grade} · 가입 완료 · 모든 선생님에게 표시 · 출석·미제출 집계 제외</p></details>}
  </section>;
}
