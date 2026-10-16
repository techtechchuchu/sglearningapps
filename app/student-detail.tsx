"use client";

import { useState } from "react";
import { displayProblemNumbers, parseProblemNumbers, splitRosterBooks } from "../lib/wrong-answers";
import AssignmentEditor from "./assignment-editor";

type Row = Record<string, any>;

export default function StudentDetail({ teacher, roster, answers, users, files, schoolAnswers, schoolExams, refresh }: {
  teacher: string; roster: Row[]; answers: Row[]; users: Row[]; files: Row[]; schoolAnswers: Row[]; schoolExams: Row[]; refresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState("");
  const [editingAssignment, setEditingAssignment] = useState(false);
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
  const registered = users.some((row) => row.username === name);
  const lastSubmitted = latest ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }).format(latest) : "기록 없음";
  return <section className="panel student-detail"><div className="student-detail-title"><h2>👤 학생 상세</h2><p>학생 정보를 확인하고 학습 기록을 살펴봅니다.</p></div>{!names.length ? <p>담당 재원생이 없습니다.</p> : <>
    <label className="student-picker">학생 선택<select value={name} onChange={(event) => { setSelected(event.target.value); setEditingAssignment(false); }}>{names.map((item) => <option key={item}>{item}</option>)}</select></label>
    <section className="student-profile"><div className="student-profile-heading"><div><h3>{name}</h3><span className={`student-status ${registered ? "is-registered" : "is-unregistered"}`}>{registered ? "가입 완료" : "미가입"}</span></div>{studentRoster.length > 0 && <button type="button" className="student-edit-toggle" aria-expanded={editingAssignment} onClick={() => setEditingAssignment((value) => !value)}>{editingAssignment ? "수정 닫기" : "정보 수정"}</button>}</div>
      <dl className="student-facts"><div><dt>학교 · 학년</dt><dd>{[...new Set(studentRoster.map((row) => [row.school_name, row.grade].filter(Boolean).join(" ")).filter(Boolean))].join(" / ") || "미입력"}</dd></div><div><dt>담당 · 반</dt><dd>{[...new Set(studentRoster.map((row) => `${row.teacher_name || "담당 미정"} · ${row.class_name || "반 미정"}`))].join(" / ") || "미배정"}</dd></div><div><dt>교재</dt><dd>{books.join(", ") || "미지정"}</dd></div></dl>
    </section>
    {editingAssignment && <section className="student-assignment-editor"><div><h3>학생 정보 수정</h3><p>변경할 명단을 수정한 뒤 저장하세요. 기존 오답과 가입 정보는 유지됩니다.</p></div>{studentRoster.map((row) => <AssignmentEditor key={row.id} row={{ id: Number(row.id), student_name: String(row.student_name || ""), teacher_name: String(row.teacher_name || ""), class_name: String(row.class_name || ""), book_name: String(row.book_name || "") }} refresh={refresh} />)}</section>}
    <div className="metrics student-detail-metrics"><article><b>{studentAnswers.length}</b><span>오답 기록</span></article><article><b>{problemCount}</b><span>누적 문제 수</span></article><article className="student-last-submission"><b>{lastSubmitted}</b><span>최근 제출</span></article></div>
    <h3>일반 오답</h3>{studentAnswers.map((row) => <div className="row" key={row.id}><strong>{row.unit} · {displayProblemNumbers(row.unit, row.problem)}번</strong><span>{row.memo || ""} · {row.created_at ? new Date(row.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : ""}</span></div>)}
    <h3>학교 기출 오답</h3>{studentSchoolAnswers.map((row) => <div className="row" key={row.id}><strong>{schoolExams.find((exam) => exam.id === row.exam_id)?.display_name || `시험 ${row.exam_id}`} · {row.problem}번</strong><span>{row.memo || ""}</span></div>)}
    <h3>오답노트 PDF</h3>{studentFiles.map((row) => <div className="row" key={row.id}><strong>{row.original_filename || "오답노트"}</strong><span><a href={`/api/files/wrong-note/${row.id}`} target="_blank" rel="noopener noreferrer">PDF 열기</a></span></div>)}
  </>}</section>;
}

