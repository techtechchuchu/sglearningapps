"use client";

import { useState } from "react";
import { displayProblemNumbers, parseProblemNumbers, splitRosterBooks } from "../lib/wrong-answers";

type Row = Record<string, any>;

export default function StudentDetail({ teacher, roster, answers, users, files, schoolAnswers, schoolExams }: {
  teacher: string; roster: Row[]; answers: Row[]; users: Row[]; files: Row[]; schoolAnswers: Row[]; schoolExams: Row[];
}) {
  const [selected, setSelected] = useState("");
  const active = roster.filter((row) => row.enrollment_status !== "퇴원");
  const names = [...new Set(active.map((row) => String(row.student_name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  const name = names.includes(selected) ? selected : names[0] || "";
  const studentRoster = active.filter((row) => row.student_name === name);
  const books = [...new Set(studentRoster.flatMap((row) => splitRosterBooks(row.book_name)))];
  const studentAnswers = answers.filter((row) => row.username === name && (teacher === "전체 관리자" || books.includes(row.unit)));
  const studentSchoolAnswers = schoolAnswers.filter((row) => row.username === name);
  const studentFiles = files.filter((row) => row.student_name === name);
  const problemCount = studentAnswers.reduce((total, row) => {
    try { return total + parseProblemNumbers(row.problem).length; } catch { return total; }
  }, 0);
  const latest = studentAnswers.map((row) => new Date(row.created_at)).filter((date) => !Number.isNaN(date.getTime())).sort((a, b) => b.getTime() - a.getTime())[0];
  return <section className="panel"><h2>👤 학생 상세</h2>{!names.length ? <p>담당 재원생이 없습니다.</p> : <>
    <label>학생 선택<select value={name} onChange={(event) => setSelected(event.target.value)}>{names.map((item) => <option key={item}>{item}</option>)}</select></label>
    <h3>{name}</h3><p>학교: {[...new Set(studentRoster.map((row) => row.school_name).filter(Boolean))].join(", ") || "-"} · 학년: {[...new Set(studentRoster.map((row) => row.grade).filter(Boolean))].join(", ") || "-"}</p>
    <p>담당: {[...new Set(studentRoster.map((row) => row.teacher_name).filter(Boolean))].join(", ")} · 반: {[...new Set(studentRoster.map((row) => row.class_name).filter(Boolean))].join(", ")}</p>
    <p>교재: {books.join(", ") || "-"}</p>
    <div className="metrics"><article><b>{users.some((row) => row.username === name) ? "가입 완료" : "미가입"}</b><span>가입 상태</span></article><article><b>{studentAnswers.length}</b><span>오답 기록</span></article><article><b>{problemCount}</b><span>누적 문제 수</span></article><article><b>{latest ? latest.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "-"}</b><span>최근 제출</span></article></div>
    <h3>일반 오답</h3>{studentAnswers.map((row) => <div className="row" key={row.id}><strong>{row.unit} · {displayProblemNumbers(row.unit, row.problem)}번</strong><span>{row.memo || ""} · {row.created_at ? new Date(row.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : ""}</span></div>)}
    <h3>학교 기출 오답</h3>{studentSchoolAnswers.map((row) => <div className="row" key={row.id}><strong>{schoolExams.find((exam) => exam.id === row.exam_id)?.display_name || `시험 ${row.exam_id}`} · {row.problem}번</strong><span>{row.memo || ""}</span></div>)}
    <h3>오답노트 PDF</h3>{studentFiles.map((row) => <div className="row" key={row.id}><strong>{row.original_filename || "오답노트"}</strong><span><a href={`/api/files/wrong-note/${row.id}`} target="_blank" rel="noopener noreferrer">PDF 열기</a></span></div>)}
  </>}</section>;
}
