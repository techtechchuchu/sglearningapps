"use client";

import { useState } from "react";

type Student = { student_name: string; class_name: string };

export default function TeacherAttendance({ roster }: { roster: Student[] }) {
  const classes = [...new Set(roster.map((row) => row.class_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  const [className, setClassName] = useState("");
  const students = [...new Map(roster.filter((row) => !className || row.class_name === className).map((row) => [`${row.student_name}\u0000${row.class_name}`, row])).values()];

  return <section className="panel attendance-panel"><h2>📍 학생 출석 목록 <small>데모</small></h2>
    <p className="attendance-notice">실제 재원 학생 명단을 보여줍니다. 출석 체크 기록 저장은 아직 연결되지 않아 출석·결석 상태를 표시하지 않습니다.</p>
    <label>반 선택<select value={className} onChange={(event) => setClassName(event.target.value)}><option value="">전체 반</option>{classes.map((name) => <option key={name}>{name}</option>)}</select></label>
    <p>대상 학생 {students.length}명 · 출석 기록 연결 전</p>
    {students.map((student) => <div className="row workspace-record" key={`${student.student_name}-${student.class_name}`}><div><strong>{student.student_name} · {student.class_name}</strong><span>출석 기록 없음 · 데모 화면</span></div></div>)}
    <div className="attendance-code"><p>5층 교실 코드 방식 예시</p><strong>SGDEMO</strong><small>체험용 코드입니다. 실제 출석 인증이나 기록 저장에는 사용할 수 없습니다.</small></div>
  </section>;
}

