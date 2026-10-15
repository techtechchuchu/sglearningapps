"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Student = { student_name: string; class_name: string; teacher_name: string };
type AttendanceRecord = { id: number; student_name: string; class_name: string; teacher_name: string; status: string; check_in_at: string | null };
type ActiveCode = { teacher_name: string; class_name: string };
const STATUS: Record<string, string> = { pending: "확인 대기", present: "출석", late: "지각", absent: "결석" };
const FIXED_DEMO_URL = "https://studygyeol.vercel.app/#attendance=hdEPa9KwS9vGVCwsrP65u_YeE9PZ-T_E";

function koreanDate() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `요청 실패 (${response.status})`);
  return data;
}

export default function TeacherAttendance({ roster, teacher }: { roster: Student[]; teacher: string }) {
  const [date, setDate] = useState(koreanDate);
  const [classKey, setClassKey] = useState("");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [activeCodes, setActiveCodes] = useState<ActiveCode[]>([]);
  const [newCode, setNewCode] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [fixedQrImage, setFixedQrImage] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const ownRoster = teacher === "전체 관리자" ? roster : roster.filter((row) => row.teacher_name === teacher);
  const classes = [...new Map(ownRoster.filter((row) => row.class_name && row.teacher_name).map((row) => [`${row.teacher_name}\0${row.class_name}`, { teacherName: row.teacher_name, className: row.class_name }])).entries()];
  const students = [...new Map(ownRoster.filter((row) => !classKey || `${row.teacher_name}\0${row.class_name}` === classKey).map((row) => [`${row.teacher_name}\0${row.class_name}\0${row.student_name}`, row])).values()].sort((a, b) => a.student_name.localeCompare(b.student_name, "ko"));
  const filteredRecords = records.filter((record) => !classKey || `${record.teacher_name}\0${record.class_name}` === classKey);
  const byStudent = new Map(filteredRecords.map((record) => [`${record.teacher_name}\0${record.class_name}\0${record.student_name}`, record]));
  const selectedClass = classes.find(([key]) => key === classKey)?.[1];
  const hasCode = Boolean(selectedClass && activeCodes.some((item) => item.teacher_name === selectedClass.teacherName && item.class_name === selectedClass.className));

  useEffect(() => { void QRCode.toDataURL(FIXED_DEMO_URL, { width: 320, margin: 3, errorCorrectionLevel: "H" }).then(setFixedQrImage).catch(() => {}); }, []);

  useEffect(() => {
    const controller = new AbortController();
    setMessage(""); setNewCode(""); setQrImage("");
    fetch(`/api/attendance?date=${encodeURIComponent(date)}`, { signal: controller.signal }).then(readJson).then((data) => {
      if (controller.signal.aborted) return;
      setRecords(data.records || []); setActiveCodes(data.activeCodes || []);
    }).catch((cause) => { if (!controller.signal.aborted) setMessage(cause instanceof Error ? cause.message : "출석 기록을 불러오지 못했습니다."); });
    return () => controller.abort();
  }, [date]);

  async function refresh() {
    const data = await readJson(await fetch(`/api/attendance?date=${encodeURIComponent(date)}`));
    setRecords(data.records || []); setActiveCodes(data.activeCodes || []);
  }

  async function createCode() {
    if (!selectedClass) return;
    if (hasCode && !window.confirm("새 코드를 만들면 이전 코드는 사용할 수 없습니다. 다시 발급할까요?")) return;
    setBusy(true); setMessage("");
    try {
      const data = await readJson(await fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createCode", teacherName: selectedClass.teacherName, className: selectedClass.className }) }));
      const payload = JSON.stringify({ type: "sg-attendance", version: 1, date: koreanDate(), teacherName: selectedClass.teacherName, className: selectedClass.className, code: data.code });
      setQrImage(await QRCode.toDataURL(payload, { width: 320, margin: 2, errorCorrectionLevel: "M" }));
      setNewCode(data.code); await refresh(); setMessage(data.message);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "코드를 만들지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function changeStatus(student: Student, status: string) {
    setBusy(true); setMessage("");
    try {
      await readJson(await fetch("/api/attendance", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentName: student.student_name, teacherName: student.teacher_name, className: student.class_name, date, status }) }));
      await refresh(); setMessage(`${student.student_name} 학생의 상태를 ${STATUS[status]}(으)로 저장했습니다.`);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "출석 상태를 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <section className="panel attendance-panel">
    <div className="attendance-heading"><div><span className="attendance-eyebrow">선생님 관리</span><h2>날짜별 출석 관리</h2></div></div>
    <p>일반 반은 학생의 체크가 <strong>확인 대기</strong>로 접수됩니다. 출석 데모반의 고정 QR은 스캔 즉시 출석 처리되며, 선생님이 날짜별 기록을 확인·수정할 수 있습니다.</p>
    <div className="attendance-filters"><label>조회 날짜<input type="date" value={date} max={koreanDate()} onChange={(event) => setDate(event.target.value)} /></label><label>반 선택<select value={classKey} onChange={(event) => { setClassKey(event.target.value); setNewCode(""); setQrImage(""); }}><option value="">전체 반</option>{classes.map(([key, item]) => <option value={key} key={key}>{item.className} · {item.teacherName}</option>)}</select></label></div>
    {selectedClass && selectedClass.teacherName === "전체 관리자" && selectedClass.className === "출석 데모반" && <div className="attendance-code"><p>출석 데모반 · 교실 고정 QR</p><strong>매일 발급할 필요가 없습니다.</strong>{fixedQrImage && <div className="attendance-qr"><img src={fixedQrImage} alt="출석 데모반 고정 출석 QR 코드" width="240" height="240" /><a href={fixedQrImage} download="출석데모반-교실QR.png">QR 이미지 저장</a></div>}<small>휴대폰 기본 카메라로 스캔하면 학생 로그인·출석 화면으로 이동한 뒤 자동 출석을 시도합니다. 사이트의 QR 스캐너로도 사용할 수 있습니다. QR 사진은 공유될 수 있으므로 데모 운영에만 사용하세요.</small></div>}
    {selectedClass && !(selectedClass.teacherName === "전체 관리자" && selectedClass.className === "출석 데모반") && date === koreanDate() && <div className="attendance-code"><p>{selectedClass.className} · 오늘의 교실 QR</p><button type="button" disabled={busy} onClick={() => void createCode()}>{hasCode ? "새 QR 발급" : "오늘 QR 만들기"}</button>{qrImage && <div className="attendance-qr"><img src={qrImage} alt={`${selectedClass.className} 오늘 출석 QR 코드`} width="240" height="240" /><span>학생은 출석 화면에서 카메라로 스캔하세요.</span></div>}{newCode && <strong aria-label="오늘 출석 코드">수동 코드 {newCode}</strong>}<small>{hasCode && !newCode ? "QR이 이미 발급됐습니다. 다시 표시하려면 새 QR을 발급해야 합니다." : "QR은 교실에서만 보여주세요. 5층 위치를 GPS만으로 확인할 수는 없습니다."}</small></div>}
    {message && <p className="workspace-message" role="status">{message}</p>}
    <div className="attendance-summary"><span>대상 <strong>{students.length}</strong>명</span><span>출석 <strong>{filteredRecords.filter((row) => row.status === "present").length}</strong>명</span><span>지각 <strong>{filteredRecords.filter((row) => row.status === "late").length}</strong>명</span><span>결석 <strong>{filteredRecords.filter((row) => row.status === "absent").length}</strong>명</span><span>확인 대기 <strong>{filteredRecords.filter((row) => row.status === "pending").length}</strong>명</span></div>
    {students.length ? <div className="attendance-teacher-list">{students.map((student) => {
      const key = `${student.teacher_name}\0${student.class_name}\0${student.student_name}`;
      const record = byStudent.get(key);
      return <div className="attendance-teacher-row" key={key}><div><strong>{student.student_name}</strong><small>{student.class_name} · {student.teacher_name}</small></div><span className={`attendance-status attendance-status-${record?.status || "none"}`}>{record ? STATUS[record.status] || record.status : "미확인"}</span><div className="attendance-actions" aria-label={`${student.student_name} 출석 상태 변경`}>{(["present", "late", "absent"] as const).map((status) => <button type="button" key={status} className={record?.status === status ? "active" : ""} disabled={busy} onClick={() => void changeStatus(student, status)}>{STATUS[status]}</button>)}</div></div>;
    })}</div> : <p>조회할 학생이 없습니다.</p>}
  </section>;
}

