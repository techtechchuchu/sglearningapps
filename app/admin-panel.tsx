"use client";

import { FormEvent, useEffect, useState } from "react";

type Row = Record<string, any>;
type AdminData = { books: Row[]; exams: Row[]; notices: Row[] };
type ImportedEnrollment = { student: string; teacher: string; className: string; source: string };
type AcademyRequest = { id:string; student_name:string; teacher_name:string; school:string; grade:string; requested_class:string; requested_books:string[] };

async function parse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "요청을 처리하지 못했습니다.");
  return body;
}

export default function AdminPanel({ roster, users, activeBooks, refreshRoster, initialSection = "matching" }: { roster: Row[]; users: Row[]; activeBooks: string[]; refreshRoster: () => Promise<void>; initialSection?: "matching" | "roster" | "members" }) {
  const [data, setData] = useState<AdminData>({ books: [], exams: [], notices: [] });
  const [section, setSection] = useState<"matching" | "roster" | "members" | "books" | "exams" | "notices">(initialSection);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [selectedMember, setSelectedMember] = useState("");
  const [memberTeacher, setMemberTeacher] = useState("이주백.T");
  const [memberClass, setMemberClass] = useState("");
  const [memberSchool, setMemberSchool] = useState("");
  const [memberBooks, setMemberBooks] = useState<string[]>([]);
  const [rosterForm, setRosterForm] = useState({ teacher_name: "", class_name: "", school_name: "", grade: "", book_name: "" });
  const [bookName, setBookName] = useState("");
  const [bookSubject, setBookSubject] = useState("");
  const [bookEditId, setBookEditId] = useState("");
  const [bookEdit, setBookEdit] = useState({ grade: "", subject: "", publisher: "", category: "교재", questionCount: "" });
  const [examEditId, setExamEditId] = useState("");
  const [examEdit, setExamEdit] = useState({ scope: "", questionCount: "" });
  const [examYear, setExamYear] = useState(String(new Date().getFullYear()));
  const [examSchool, setExamSchool] = useState("");
  const [examSubject, setExamSubject] = useState("");
  const [examType, setExamType] = useState("");
  const [examCount, setExamCount] = useState("");
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [noticeTarget, setNoticeTarget] = useState("all");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [importedEnrollments, setImportedEnrollments] = useState<ImportedEnrollment[]>([]);
  const [compareQuery, setCompareQuery] = useState("");
  const [compareFilter, setCompareFilter] = useState("전체");
  const [compareMessage, setCompareMessage] = useState("");
  const [compareBusy, setCompareBusy] = useState(false);
  const [academyRequests,setAcademyRequests] = useState<AcademyRequest[]>([]);

  async function reload() { setData(await parse(await fetch("/api/admin/manage", { cache: "no-store" }))); }
  useEffect(() => { void reload().catch((error) => setMessage(error.message)); }, []);
  useEffect(() => {
    let mounted=true;
    const load=async()=>{try{const result=await parse(await fetch("/api/academy/requests",{cache:"no-store"}));if(mounted)setAcademyRequests(result.requests||[]);}catch{/* The review panel shows request errors. */}};
    void load();
    window.addEventListener("academy-reviewed",load);
    return()=>{mounted=false;window.removeEventListener("academy-reviewed",load);};
  },[]);
  async function run(task: () => Promise<void>) { setBusy(true); setMessage(""); try { await task(); } catch (error) { setMessage(error instanceof Error ? error.message : "실패했습니다."); } finally { setBusy(false); } }
  async function create(input: Row, event: FormEvent) { event.preventDefault(); await run(async () => { await parse(await fetch("/api/admin/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) })); await reload(); setMessage("등록했습니다."); }); }
  async function update(input: Row) { await run(async () => { await parse(await fetch("/api/admin/manage", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) })); await reload(); await refreshRoster(); setMessage("변경했습니다."); }); }
  function selectRoster(id: string) { setSelectedRosterId(id); const row = roster.find((item) => String(item.id) === id); if (row) setRosterForm({ teacher_name: row.teacher_name || "", class_name: row.class_name || "", school_name: row.school_name || "", grade: row.grade || "", book_name: row.book_name || "" }); }
  function selectBook(id: string) { setBookEditId(id); const row = data.books.find((item) => String(item.id) === id); if (row) setBookEdit({ grade: row.grade || "", subject: row.subject || "", publisher: row.publisher || "", category: row.category || "교재", questionCount: row.question_count == null ? "" : String(row.question_count) }); }
  function selectExam(id: string) { setExamEditId(id); const row = data.exams.find((item) => String(item.id) === id); if (row) setExamEdit({ scope: row.scope || "", questionCount: row.question_count == null ? "" : String(row.question_count) }); }
  const member = users.find((row) => row.username === selectedMember);
  const memberRoster = roster.filter((row) => row.student_name === selectedMember && row.enrollment_status !== "퇴원");
  const unassigned = users.filter((row) => !roster.some((item) => item.student_name === row.username && item.enrollment_status !== "퇴원"));
  const pendingWithoutRoster=academyRequests.filter((request)=>!roster.some((item)=>item.student_name===request.student_name&&item.teacher_name===request.teacher_name&&item.enrollment_status!=="퇴원"));
  const normalize = (value: unknown) => String(value || "").toLowerCase().replace(/[\s._·-]/g, "");
  const centralStudents = [...new Map(importedEnrollments.map((row) => [normalize(row.student), row.student])).values()];
  const portalNames = new Set([...users.map((row) => String(row.username || "")), ...roster.map((row) => String(row.student_name || ""))]);
  const compareRows = centralStudents.map((student) => {
    const central = importedEnrollments.filter((row) => normalize(row.student) === normalize(student));
    const appRows = roster.filter((row) => normalize(row.student_name) === normalize(student) && row.enrollment_status !== "퇴원");
    const account = users.some((row) => normalize(row.username) === normalize(student));
    const missingAssignments = central.filter((source) => !appRows.some((target) => normalize(target.teacher_name) === normalize(source.teacher) && normalize(target.class_name) === normalize(source.className)));
    const status = !appRows.length ? "미매칭" : missingAssignments.length ? "배정 확인" : "매칭";
    return { student, central, appRows, account, status };
  });
  const portalOnlyNames = [...portalNames].filter((name) => name && !centralStudents.some((student) => normalize(student) === normalize(name)));
  const visibleCompareRows = compareRows.filter((row) => {
    const matchesFilter = compareFilter === "전체" || row.status === compareFilter || (compareFilter === "미가입" && !row.account) || (compareFilter === "앱에만 있음" && false);
    const matchesQuery = !compareQuery.trim() || normalize(`${row.student} ${row.central.map((item) => `${item.teacher} ${item.className}`).join(" ")} ${row.appRows.map((item) => `${item.teacher_name} ${item.class_name}`).join(" ")}`).includes(normalize(compareQuery));
    return matchesFilter && matchesQuery;
  });
  async function compareRoster(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!form.getAll("files").length) { setCompareMessage("중심업무에서 내려받은 Excel 명단을 선택해주세요."); return; }
    setCompareBusy(true); setCompareMessage("");
    try {
      const response = await fetch("/api/admin/roster-compare", { method: "POST", body: form });
      const result = await parse(response);
      setImportedEnrollments(result.rows || []);
      setCompareMessage(`${result.sources?.length || 0}개 파일을 비교했습니다. 중복 수강 행 ${result.duplicateRows || 0}건은 학생별 반 목록으로 합쳐 표시합니다.`);
    } catch (error) { setCompareMessage(error instanceof Error ? error.message : "명단 비교에 실패했습니다."); }
    finally { setCompareBusy(false); }
  }
  async function assignMember(event: FormEvent) {
    event.preventDefault();
    if (!member || !memberClass.trim() || !memberBooks.length) return;
    await run(async () => {
      const result = await parse(await fetch("/api/staff/roster", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "register", studentName: member.username, teacherName: memberTeacher, className: memberClass, schoolName: memberSchool, grade: member.grade, books: memberBooks }) }));
      await refreshRoster();
      setMessage(result.message || "학생을 배정했습니다.");
    });
  }

  return <section className="panel"><h2>전체 관리자 관리</h2><nav className="workspace-tabs" aria-label="관리 메뉴">{[["matching", "가입·명단 매칭"], ["roster", "학생 정보"], ["members", "회원 목록"], ["books", "교재"], ["exams", "학교 기출"], ["notices", "공지사항"]].map(([value, label]) => <button key={value} className={section === value ? "active" : ""} onClick={() => { setSection(value as typeof section); setMessage(""); }}>{label}</button>)}</nav>
    {message && <p className="workspace-message" role="status">{message}</p>}
    {(section==="matching"||section==="members")&&<section className="panel"><h3>가입 완료 · 명단 미등록 {pendingWithoutRoster.length}명</h3><p>학원 연결을 신청했지만 해당 담당 선생님 명단에서 아직 찾지 못한 학생입니다. 신청 내용과 실제 재원 여부를 확인한 뒤 명단을 등록하고 승인하세요.</p>{pendingWithoutRoster.map((request)=><div className="row workspace-record" key={request.id}><div><strong>{request.student_name} · {request.teacher_name}</strong><span>{request.school||"학교 미등록"} · {request.grade||"학년 미등록"} · 신청 반 {request.requested_class||"미입력"} · 교재 {(request.requested_books||[]).join(", ")||"미입력"}</span></div><button type="button" onClick={()=>{const review=document.getElementById("academy-review");if(review instanceof HTMLDetailsElement){review.open=true;review.scrollIntoView({behavior:"smooth"});}}}>신청 확인</button></div>)}</section>}
    {section === "matching" && <><h3>중심업무 명단 대조</h3><p>중심업무 Excel 명단을 올리면 가입 여부와 현재 학생·반 배정을 한 화면에서 확인합니다. 이름이 같은 학생은 한 명으로 묶고, 수강 중인 반은 모두 표시합니다. 업로드한 파일은 비교에만 사용됩니다.</p><form className="form workspace-form" onSubmit={(event) => void compareRoster(event)}><label>중심업무 Excel 파일 선택 (선생님별 파일을 여러 개 선택 가능)<input name="files" type="file" accept=".xlsx" multiple required /></label><button className="primary" disabled={compareBusy}>{compareBusy ? "명단 비교 중…" : "명단 비교하기"}</button></form>{compareMessage && <p className="workspace-message" role="status">{compareMessage}</p>}
      {importedEnrollments.length > 0 && <><div className="metrics"><article><b>{centralStudents.length}</b><span>중심업무 학생</span></article><article><b>{compareRows.filter((row) => row.status === "매칭").length}</b><span>배정 매칭</span></article><article><b>{compareRows.filter((row) => row.status !== "매칭").length}</b><span>미매칭·배정 확인</span></article><article><b>{compareRows.filter((row) => !row.account).length}</b><span>미가입</span></article><article><b>{portalOnlyNames.length}</b><span>앱에만 있음</span></article></div><div className="workspace-filters"><label>이름·반 검색<input value={compareQuery} onChange={(event) => setCompareQuery(event.target.value)} placeholder="학생 이름 또는 반 입력" /></label><label>현황 필터<select value={compareFilter} onChange={(event) => setCompareFilter(event.target.value)}>{["전체", "매칭", "미매칭", "배정 확인", "미가입", "앱에만 있음"].map((item) => <option key={item}>{item}</option>)}</select></label></div><h4>중심업무 명단 · {visibleCompareRows.length}명 표시</h4>{visibleCompareRows.map((row) => <article className="question-card" key={row.student}><div className="question-card-head"><strong>{row.student}</strong><span>{row.account ? "가입" : "미가입"} · {row.status}</span></div><div><strong>중심업무 반</strong><ul>{row.central.map((item, index) => <li key={`${item.teacher}-${item.className}-${index}`}>{item.teacher} · {item.className}</li>)}</ul></div><div><strong>스터디결 배정</strong>{row.appRows.length ? <ul>{row.appRows.map((item) => <li key={item.id}>{item.teacher_name} · {item.class_name} · {item.school_name || "학교 미지정"} {item.grade || ""} · {item.book_name || "교재 미지정"}</li>)}</ul> : <p>등록된 반 배정이 없습니다.</p>}</div></article>)}{compareFilter === "앱에만 있음" && <><h4>앱에는 있지만 중심업무 명단에 없는 학생 · {portalOnlyNames.length}명</h4>{portalOnlyNames.map((name) => <div className="row workspace-record" key={name}><div><strong>{name}</strong><span>{roster.filter((row) => normalize(row.student_name) === normalize(name)).map((row) => `${row.teacher_name} · ${row.class_name}`).join(" / ") || "명단 배정 전"} · {users.some((row) => normalize(row.username) === normalize(name)) ? "가입" : "미가입"}</span></div></div>)}</>}</>}
    </>}
    {section === "roster" && <p><a className="export-link" href="/api/admin/export?kind=roster">현재 학생명단 엑셀 다운로드</a> · 재원생과 퇴원생을 모두 포함합니다.</p>}
    {section === "members" && <><h3>가입 회원 목록 · {users.length}명</h3><p>명단 미배정 {unassigned.length}명. 가입만 한 학생도 여기서 담당 선생님·반·교재를 지정할 수 있습니다.</p><label>회원 선택<select value={selectedMember} onChange={(event) => { setSelectedMember(event.target.value); setMemberBooks([]); setMemberClass(""); setMemberSchool(""); }}><option value="">선택해주세요</option><optgroup label={`명단 미배정 (${unassigned.length}명)`}>{unassigned.map((row) => <option key={row.username} value={row.username}>{row.username} · {row.grade || "학년 미지정"}</option>)}</optgroup><optgroup label="배정 완료">{users.filter((row) => !unassigned.includes(row)).map((row) => <option key={row.username} value={row.username}>{row.username} · {row.grade || "학년 미지정"}</option>)}</optgroup></select></label>{member && <><p>{member.username} · {member.grade || "학년 미지정"} · {memberRoster.length ? `명단 ${memberRoster.length}건` : "아직 명단에 없음"}</p>{memberRoster.length ? <><h4>현재 배정</h4>{memberRoster.map((row) => <div className="row workspace-record" key={row.id}><div><strong>{row.teacher_name} · {row.class_name}</strong><span>{row.school_name || "학교 미지정"} · {row.book_name || "교재 미지정"}</span></div><button type="button" onClick={() => { selectRoster(String(row.id)); setSection("roster"); }}>정보 수정</button></div>)}</> : <form className="form workspace-form" onSubmit={(event) => void assignMember(event)}><h4>신규 회원 명단 배정</h4><label>담당 선생님<select value={memberTeacher} onChange={(event) => setMemberTeacher(event.target.value)}>{["이주백.T", "박병민.T", "노대근.T"].map((name) => <option key={name}>{name}</option>)}</select></label><label>반<input value={memberClass} onChange={(event) => setMemberClass(event.target.value)} required /></label><label>학교<input value={memberSchool} onChange={(event) => setMemberSchool(event.target.value)} /></label><fieldset><legend>교재</legend>{activeBooks.map((book) => <label className="workspace-check" key={book}><input type="checkbox" checked={memberBooks.includes(book)} onChange={(event) => setMemberBooks((current) => event.target.checked ? [...current, book] : current.filter((value) => value !== book))} /> {book}</label>)}</fieldset><button className="primary" disabled={busy || !memberClass.trim() || !memberBooks.length}>명단에 배정</button></form>}</>}<p>학생 이름·학년·가입일·오답 건수만 내려받습니다. 비밀번호는 포함하지 않습니다.</p><a className="export-link" href="/api/admin/export?kind=members">회원 목록 엑셀 다운로드</a></>}
    {section === "roster" && <><h3>학생 명단 정보 수정</h3><div className="form workspace-form"><label>명단 행 선택<select value={selectedRosterId} onChange={(event) => selectRoster(event.target.value)}><option value="">선택해주세요</option>{roster.map((row) => <option key={row.id} value={row.id}>{row.student_name} · {row.class_name} · {row.teacher_name}</option>)}</select></label>{selectedRosterId && <>{Object.entries({ teacher_name: "담당 선생님", class_name: "반", school_name: "학교", grade: "학년", book_name: "교재(여러 개는 쉼표로 구분)" }).map(([field, label]) => <label key={field}>{label}<input value={rosterForm[field as keyof typeof rosterForm]} onChange={(event) => setRosterForm({ ...rosterForm, [field]: event.target.value })} /></label>)}<button className="primary" disabled={busy} onClick={() => void update({ type: "roster", id: Number(selectedRosterId), ...rosterForm })}>변경 저장</button></>}</div></>}
    {section === "books" && <><h3>교재 등록</h3><form className="form workspace-form" onSubmit={(event) => void create({ type: "book", bookName, subject: bookSubject }, event)}><label>교재명<input value={bookName} onChange={(event) => setBookName(event.target.value)} required /></label><label>과목<input value={bookSubject} onChange={(event) => setBookSubject(event.target.value)} /></label><button className="primary" disabled={busy}>교재 등록</button></form><h3>등록 교재</h3>{data.books.map((row) => <div className="row workspace-record" key={row.id}><div><strong>{row.book_name}</strong><span>{row.subject} · {row.is_active ? "사용 중" : "중지"}</span></div><div><button disabled={busy} onClick={() => void update({ type: "book", id: row.id, isActive: !row.is_active })}>{row.is_active ? "사용 중지" : "다시 사용"}</button></div></div>)}</>}
    {section === "exams" && <><h3>학교 기출 등록</h3><form className="form workspace-form" onSubmit={(event) => void create({ type: "exam", examYear, schoolName: examSchool, subject: examSubject, examType, questionCount: examCount }, event)}><label>연도<input type="number" value={examYear} onChange={(event) => setExamYear(event.target.value)} required /></label><label>학교<input value={examSchool} onChange={(event) => setExamSchool(event.target.value)} required /></label><label>과목<input value={examSubject} onChange={(event) => setExamSubject(event.target.value)} required /></label><label>시험구분<input value={examType} onChange={(event) => setExamType(event.target.value)} placeholder="예: 1학기 중간" required /></label><label>문항수<input type="number" value={examCount} onChange={(event) => setExamCount(event.target.value)} /></label><button className="primary" disabled={busy}>학교 기출 등록</button></form><h3>등록된 시험</h3>{data.exams.map((row) => <div className="row workspace-record" key={row.id}><div><strong>{row.display_name}</strong><span>{row.school_name} · {row.subject} · {row.is_active ? "사용 중" : "중지"}</span></div><div><button disabled={busy} onClick={() => void update({ type: "exam", id: row.id, isActive: !row.is_active })}>{row.is_active ? "사용 중지" : "다시 사용"}</button></div></div>)}</>}
    {section === "notices" && <><h3>공지 등록</h3><form className="form workspace-form" onSubmit={(event) => void create({ type: "notice", title: noticeTitle, content: noticeContent, target: noticeTarget, isActive: true }, event)}><label>제목<input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} required /></label><label>내용<textarea value={noticeContent} onChange={(event) => setNoticeContent(event.target.value)} required /></label><label>대상<select value={noticeTarget} onChange={(event) => setNoticeTarget(event.target.value)}><option value="all">전체</option><option value="student">학생</option><option value="teacher">선생님</option></select></label><button className="primary" disabled={busy}>공지 등록</button></form><h3>등록된 공지</h3>{data.notices.map((row) => <div className="row workspace-record" key={row.id}><div><strong>{row.title}</strong><span>{row.content} · {row.target} · {row.is_active ? "노출 중" : "숨김"}</span></div><div><button disabled={busy} onClick={() => void update({ type: "notice", id: row.id, isActive: !row.is_active })}>{row.is_active ? "숨기기" : "노출"}</button></div></div>)}</>}
    {section === "books" && <div className="admin-detail-editor panel"><h3>교재 상세 정보 수정</h3><p>교재명 변경은 오답·명단 연결에 영향을 줄 수 있어 별도 점검 후 처리합니다.</p><form className="form workspace-form" onSubmit={(event) => { event.preventDefault(); if (bookEditId) void update({ type: "book-details", id: Number(bookEditId), ...bookEdit }); }}>
      <label>수정할 교재<select value={bookEditId} onChange={(event) => selectBook(event.target.value)} required><option value="">선택해주세요</option>{data.books.map((row) => <option key={row.id} value={row.id}>{row.book_name}</option>)}</select></label>
      {bookEditId && <><label>학년<input value={bookEdit.grade} onChange={(event) => setBookEdit({ ...bookEdit, grade: event.target.value })}/></label><label>과목<input value={bookEdit.subject} onChange={(event) => setBookEdit({ ...bookEdit, subject: event.target.value })}/></label><label>출판사<input value={bookEdit.publisher} onChange={(event) => setBookEdit({ ...bookEdit, publisher: event.target.value })}/></label><label>분류<input value={bookEdit.category} onChange={(event) => setBookEdit({ ...bookEdit, category: event.target.value })}/></label><label>문항 수<input type="number" min="0" value={bookEdit.questionCount} onChange={(event) => setBookEdit({ ...bookEdit, questionCount: event.target.value })}/></label><button className="primary" disabled={busy}>상세 정보 저장</button></>}
    </form></div>}
    {section === "exams" && <div className="admin-detail-editor panel"><h3>학교 기출 상세 정보 수정</h3><p>기존 오답과 연결되는 시험 ID·학교·연도는 유지합니다.</p><form className="form workspace-form" onSubmit={(event) => { event.preventDefault(); if (examEditId) void update({ type: "exam-details", id: Number(examEditId), ...examEdit }); }}>
      <label>수정할 시험<select value={examEditId} onChange={(event) => selectExam(event.target.value)} required><option value="">선택해주세요</option>{data.exams.map((row) => <option key={row.id} value={row.id}>{row.display_name}</option>)}</select></label>
      {examEditId && <><label>시험 범위<input value={examEdit.scope} onChange={(event) => setExamEdit({ ...examEdit, scope: event.target.value })}/></label><label>문항 수<input type="number" min="0" value={examEdit.questionCount} onChange={(event) => setExamEdit({ ...examEdit, questionCount: event.target.value })}/></label><button className="primary" disabled={busy}>상세 정보 저장</button></>}
    </form></div>}
  </section>;
}
