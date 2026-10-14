import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { staffSession } from "../../../../lib/staff-access";

const ADMIN = "전체 관리자";
const TEACHERS = ["이주백.T", "박병민.T", "노대근.T"];

function cleaned(value: unknown) { return String(value ?? "").trim(); }
function rosterPayload(body: Record<string, unknown>, teacher: string) {
  const teacherName = teacher === ADMIN ? cleaned(body.teacherName) : teacher;
  const books = Array.isArray(body.books) ? [...new Set(body.books.map(cleaned).filter(Boolean))] : [];
  const studentName = cleaned(body.studentName);
  const className = cleaned(body.className);
  if (!TEACHERS.includes(teacherName) || !studentName || !className || !books.length) return null;
  return {
    teacher_name: teacherName, student_name: studentName, class_name: className,
    school_name: cleaned(body.schoolName), grade: cleaned(body.grade),
    book_name: books.join(", "), created_at: new Date().toISOString(),
    enrollment_status: "재원", exited_at: null as string | null,
    status_note: cleaned(body.statusNote),
  };
}

export async function POST(request: NextRequest) {
  try {
    const teacher = staffSession(request);
    if (!teacher) return NextResponse.json({ message: "선생님 로그인이 필요합니다." }, { status: 401 });
    const body = await request.json();
    const db = getServerSupabase();
    if (body.action === "register") {
      const payload = rosterPayload(body, teacher);
      if (!payload) return NextResponse.json({ message: "학생·반·교재를 확인해주세요." }, { status: 400 });
      const activeBooks = await db.from("book_master").select("book_name").eq("is_active", true);
      if (activeBooks.error) throw activeBooks.error;
      const allowed = new Set((activeBooks.data || []).map((row) => row.book_name));
      if (payload.book_name.split(", ").some((book) => !allowed.has(book))) return NextResponse.json({ message: "현재 사용 중인 교재만 선택할 수 있습니다." }, { status: 400 });
      const created = await db.from("student_roster").insert(payload).select("id").single();
      if (created.error) throw created.error;
      const verified = await db.from("student_roster").select("id,teacher_name,student_name,enrollment_status").eq("id", created.data.id).single();
      if (verified.error || verified.data?.student_name !== payload.student_name || verified.data.teacher_name !== payload.teacher_name || verified.data.enrollment_status !== "재원") throw verified.error || new Error("Roster readback mismatch");
      return NextResponse.json({ ok: true, id: created.data.id, message: "신규생 등록을 확인했습니다. 학생 계정은 별도 회원가입이 필요합니다." }, { status: 201 });
    }
    if (body.action === "reenter") {
      const sourceId = Number(body.sourceId);
      if (!Number.isSafeInteger(sourceId) || sourceId <= 0) return NextResponse.json({ message: "퇴원 이력을 선택해주세요." }, { status: 400 });
      const source = await db.from("student_roster").select("*").eq("id", sourceId).single();
      if (source.error || !source.data) return NextResponse.json({ message: "퇴원 이력을 찾지 못했습니다." }, { status: 404 });
      if (source.data.enrollment_status !== "퇴원" || (teacher !== ADMIN && source.data.teacher_name !== teacher)) return NextResponse.json({ message: "담당 퇴원생만 재등록할 수 있습니다." }, { status: 403 });
      const payload = rosterPayload({ ...body, studentName: source.data.student_name, statusNote: `재등록 · 이전 기록ID ${sourceId}` }, teacher);
      if (!payload) return NextResponse.json({ message: "반과 교재를 확인해주세요." }, { status: 400 });
      const activeBooks = await db.from("book_master").select("book_name").eq("is_active", true);
      if (activeBooks.error) throw activeBooks.error;
      const allowed = new Set((activeBooks.data || []).map((row) => row.book_name));
      if (payload.book_name.split(", ").some((book) => !allowed.has(book))) return NextResponse.json({ message: "현재 사용 중인 교재만 선택할 수 있습니다." }, { status: 400 });
      const created = await db.from("student_roster").insert(payload).select("id").single();
      if (created.error) throw created.error;
      const verified = await db.from("student_roster").select("id,student_name,enrollment_status").eq("id", created.data.id).single();
      if (verified.error || verified.data?.student_name !== source.data.student_name || verified.data.enrollment_status !== "재원") throw verified.error || new Error("Reentry readback mismatch");
      return NextResponse.json({ ok: true, id: created.data.id, message: "재등록을 확인했습니다. 과거 오답과 퇴원 이력은 유지됩니다." }, { status: 201 });
    }
    return NextResponse.json({ message: "지원하지 않는 요청입니다." }, { status: 400 });
  } catch (error) {
    console.error("[staff roster create] failed", error);
    return NextResponse.json({ message: "학생 명단을 저장하거나 검증하지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const teacher = staffSession(request);
    if (!teacher) return NextResponse.json({ message: "선생님 로그인이 필요합니다." }, { status: 401 });
    const body = await request.json();
    const id = Number(body.id);
    if (body.action !== "exit" || !Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ message: "퇴원 처리할 학생을 선택해주세요." }, { status: 400 });
    const db = getServerSupabase();
    const existing = await db.from("student_roster").select("id,teacher_name,enrollment_status").eq("id", id).single();
    if (existing.error || !existing.data) return NextResponse.json({ message: "학생을 찾지 못했습니다." }, { status: 404 });
    if (teacher !== ADMIN && existing.data.teacher_name !== teacher) return NextResponse.json({ message: "담당 학생만 퇴원 처리할 수 있습니다." }, { status: 403 });
    if (existing.data.enrollment_status === "퇴원") return NextResponse.json({ message: "이미 퇴원 처리된 이력입니다." }, { status: 409 });
    let updateQuery = db.from("student_roster").update({ enrollment_status: "퇴원", exited_at: new Date().toISOString(), status_note: cleaned(body.note) }).eq("id", id);
    updateQuery = existing.data.enrollment_status == null ? updateQuery.is("enrollment_status", null) : updateQuery.eq("enrollment_status", existing.data.enrollment_status);
    const updated = await updateQuery.select("id").single();
    if (updated.error) throw updated.error;
    const verified = await db.from("student_roster").select("enrollment_status").eq("id", id).single();
    if (verified.error || verified.data?.enrollment_status !== "퇴원") throw verified.error || new Error("Exit readback mismatch");
    return NextResponse.json({ ok: true, message: "퇴원 처리를 확인했습니다. 기존 오답은 유지됩니다." });
  } catch (error) {
    console.error("[staff roster exit] failed", error);
    return NextResponse.json({ message: "퇴원 처리를 저장하거나 검증하지 못했습니다." }, { status: 500 });
  }
}
