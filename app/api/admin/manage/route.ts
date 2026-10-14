import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { staffSession } from "../../../../lib/staff-access";

function authorized(request: NextRequest) { return staffSession(request) === "전체 관리자"; }
function denied() { return NextResponse.json({ message: "전체 관리자만 이용할 수 있습니다." }, { status: 403 }); }

export async function GET(request: NextRequest) {
  if (!authorized(request)) return denied();
  try {
    const db = getServerSupabase();
    const [books, exams, notices] = await Promise.all([
      db.from("book_master").select("*").order("book_name").limit(2000),
      db.from("school_exam_master").select("*").order("exam_year", { ascending: false }).limit(2000),
      db.from("notices").select("*").order("priority", { ascending: false }).limit(200),
    ]);
    if (books.error || exams.error || notices.error) throw books.error || exams.error || notices.error;
    return NextResponse.json({ books: books.data || [], exams: exams.data || [], notices: notices.data || [] });
  } catch (error) {
    console.error("[admin data] failed", error);
    return NextResponse.json({ message: "관리 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return denied();
  try {
    const input = await request.json();
    const db = getServerSupabase();
    if (input.type === "book") {
      const name = String(input.bookName || "").trim();
      if (!name) return NextResponse.json({ message: "교재명을 입력해주세요." }, { status: 400 });
      const existing = await db.from("book_master").select("id").eq("book_name", name).limit(1);
      if (existing.error) throw existing.error;
      if (existing.data?.length) return NextResponse.json({ message: "이미 등록된 교재입니다." }, { status: 409 });
      const created = await db.from("book_master").insert({ book_name: name, grade: String(input.grade || "").trim(), subject: String(input.subject || "").trim(), publisher: String(input.publisher || "").trim(), question_count: Number(input.questionCount) || null, category: String(input.category || "교재").trim(), is_active: true, created_at: new Date().toISOString() }).select("*").single();
      if (created.error) throw created.error;
      return NextResponse.json({ ok: true, row: created.data }, { status: 201 });
    }
    if (input.type === "exam") {
      const year = Number(input.examYear);
      const school = String(input.schoolName || "").trim();
      const subject = String(input.subject || "").trim();
      const examType = String(input.examType || "").trim();
      if (!Number.isSafeInteger(year) || year < 2000 || !school || !subject || !examType) return NextResponse.json({ message: "연도·학교·과목·시험구분을 입력해주세요." }, { status: 400 });
      const existing = await db.from("school_exam_master").select("id").eq("exam_year", year).eq("school_name", school).eq("subject", subject).eq("exam_type", examType).limit(1);
      if (existing.error) throw existing.error;
      if (existing.data?.length) return NextResponse.json({ message: "이미 등록된 학교 기출입니다." }, { status: 409 });
      const created = await db.from("school_exam_master").insert({ exam_year: year, school_name: school, subject, exam_type: examType, question_count: Number(input.questionCount) || null, scope: String(input.scope || "").trim(), display_name: String(input.displayName || `${year} ${school} ${subject} ${examType}`).trim(), is_active: true, created_at: new Date().toISOString() }).select("*").single();
      if (created.error) throw created.error;
      return NextResponse.json({ ok: true, row: created.data }, { status: 201 });
    }
    if (input.type === "notice") {
      const title = String(input.title || "").trim();
      const content = String(input.content || "").trim();
      const target = String(input.target || "all");
      if (!title || !content || !["all", "student", "teacher"].includes(target)) return NextResponse.json({ message: "공지 제목·내용·대상을 확인해주세요." }, { status: 400 });
      const now = new Date().toISOString();
      const created = await db.from("notices").insert({ title, content, target, priority: Math.max(0, Math.min(999, Number(input.priority) || 100)), is_active: Boolean(input.isActive), created_at: now, updated_at: now }).select("*").single();
      if (created.error) throw created.error;
      return NextResponse.json({ ok: true, row: created.data }, { status: 201 });
    }
    return NextResponse.json({ message: "지원하지 않는 요청입니다." }, { status: 400 });
  } catch (error) {
    console.error("[admin create] failed", error);
    return NextResponse.json({ message: "등록하지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) return denied();
  try {
    const input = await request.json();
    const id = Number(input.id);
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ message: "수정할 항목을 선택해주세요." }, { status: 400 });
    const db = getServerSupabase();
    if (input.type === "roster") {
      const allowed = ["teacher_name", "class_name", "school_name", "grade", "book_name", "enrollment_status"];
      const payload = Object.fromEntries(allowed.filter((field) => input[field] !== undefined).map((field) => [field, String(input[field] || "").trim()]));
      if (!Object.keys(payload).length || Object.values(payload).some((value) => !value)) return NextResponse.json({ message: "수정할 정보를 입력해주세요." }, { status: 400 });
      const updated = await db.from("student_roster").update(payload).eq("id", id).select("*").single();
      if (updated.error) throw updated.error;
      return NextResponse.json({ ok: true, row: updated.data });
    }
    if (input.type === "book-details") {
      const current = await db.from("book_master").select("id,book_name").eq("id", id).single();
      if (current.error) throw current.error;
      const count = input.questionCount === "" || input.questionCount == null ? null : Number(input.questionCount);
      if (count !== null && (!Number.isSafeInteger(count) || count < 0)) return NextResponse.json({ message: "문항 수를 확인해주세요." }, { status: 400 });
      // The book name is deliberately immutable here: changing it also affects roster,
      // wrong_answers and print_status, so that needs a separate audited migration.
      const updated = await db.from("book_master").update({
        grade: String(input.grade || "").trim(), subject: String(input.subject || "").trim(),
        publisher: String(input.publisher || "").trim(), category: String(input.category || "교재").trim(),
        question_count: count,
      }).eq("id", id).select("*").single();
      if (updated.error) throw updated.error;
      return NextResponse.json({ ok: true, row: updated.data });
    }
    if (input.type === "exam-details") {
      const current = await db.from("school_exam_master").select("id,display_name").eq("id", id).single();
      if (current.error) throw current.error;
      const count = input.questionCount === "" || input.questionCount == null ? null : Number(input.questionCount);
      if (count !== null && (!Number.isSafeInteger(count) || count < 0)) return NextResponse.json({ message: "문항 수를 확인해주세요." }, { status: 400 });
      const updated = await db.from("school_exam_master").update({
        scope: String(input.scope || "").trim(), question_count: count,
      }).eq("id", id).select("*").single();
      if (updated.error) throw updated.error;
      return NextResponse.json({ ok: true, row: updated.data });
    }
    if (input.type === "book" || input.type === "exam") {
      if (typeof input.isActive !== "boolean") return NextResponse.json({ message: "사용 상태를 선택해주세요." }, { status: 400 });
      const table = input.type === "book" ? "book_master" : "school_exam_master";
      const updated = await db.from(table).update({ is_active: input.isActive }).eq("id", id).select("*").single();
      if (updated.error) throw updated.error;
      return NextResponse.json({ ok: true, row: updated.data });
    }
    if (input.type === "notice") {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.title !== undefined) payload.title = String(input.title || "").trim();
      if (input.content !== undefined) payload.content = String(input.content || "").trim();
      if (input.target !== undefined && ["all", "student", "teacher"].includes(input.target)) payload.target = input.target;
      if (input.isActive !== undefined) payload.is_active = Boolean(input.isActive);
      if (input.priority !== undefined) payload.priority = Math.max(0, Math.min(999, Number(input.priority) || 0));
      const updated = await db.from("notices").update(payload).eq("id", id).select("*").single();
      if (updated.error) throw updated.error;
      return NextResponse.json({ ok: true, row: updated.data });
    }
    return NextResponse.json({ message: "지원하지 않는 요청입니다." }, { status: 400 });
  } catch (error) {
    console.error("[admin edit] failed", error);
    return NextResponse.json({ message: "수정하지 못했습니다." }, { status: 500 });
  }
}
