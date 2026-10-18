import { NextRequest, NextResponse } from "next/server";
import { memberContext } from "../../../lib/member-auth";
import { getServerSupabase } from "../../../lib/supabase-server";

async function context(request: NextRequest) {
  const auth = await memberContext(request);
  return auth?.user.onboarding_complete ? auth : null;
}

function failure(error: unknown) {
  console.error("[university data] failed", error);
  return NextResponse.json({ message: "대학생 학습 데이터를 처리하지 못했습니다." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await context(request);
    if (!auth) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    const { db, user } = auth;
    const [courses, exams, mistakes] = await Promise.all([
      db.from("university_courses").select("id,title,semester,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      db.from("university_exams").select("id,course_id,title,exam_date").eq("user_id", user.id).order("exam_date", { ascending: true }),
      db.from("university_mistakes").select("id,course_id,problem_label,memo,reviewed,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (courses.error || exams.error || mistakes.error) throw courses.error || exams.error || mistakes.error;
    return NextResponse.json({ profile: { id: user.id, name: user.display_name, email: user.email || user.id, learnerType: user.learner_type }, courses: courses.data, exams: exams.data, mistakes: mistakes.data });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await context(request);
    if (!auth) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    const body = await request.json();
    const kind = String(body.kind || "");
    const { db, user } = auth;
    if (kind === "course") {
      const title = String(body.title || "").trim();
      const semester = String(body.semester || "").trim();
      if (!title || title.length > 100 || semester.length > 40) return NextResponse.json({ message: "과목명을 확인해주세요." }, { status: 400 });
      const result = await db.from("university_courses").insert({ user_id: user.id, title, semester });
      if (result.error) throw result.error;
    } else if (kind === "exam" || kind === "mistake") {
      const courseId = String(body.courseId || "");
      const ownership = await db.from("university_courses").select("id").eq("id", courseId).eq("user_id", user.id).maybeSingle();
      if (ownership.error) throw ownership.error;
      if (!ownership.data) return NextResponse.json({ message: "내 과목을 선택해주세요." }, { status: 400 });
      if (kind === "exam") {
        const title = String(body.title || "").trim();
        const examDate = String(body.examDate || "");
        if (!title || title.length > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(examDate) || Number.isNaN(Date.parse(examDate))) return NextResponse.json({ message: "시험명과 날짜를 확인해주세요." }, { status: 400 });
        const result = await db.from("university_exams").insert({ user_id: user.id, course_id: courseId, title, exam_date: examDate });
        if (result.error) throw result.error;
      } else {
        const label = String(body.problemLabel || "").trim();
        const memo = String(body.memo || "").trim();
        if (!label || label.length > 100 || memo.length > 2000) return NextResponse.json({ message: "문제번호와 오답 내용을 확인해주세요." }, { status: 400 });
        const result = await db.from("university_mistakes").insert({ user_id: user.id, course_id: courseId, problem_label: label, memo });
        if (result.error) throw result.error;
      }
    } else return NextResponse.json({ message: "지원하지 않는 요청입니다." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await context(request);
    if (!auth) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    const body = await request.json();
    if (typeof body.reviewed !== "boolean") return NextResponse.json({ message: "복습 상태를 확인해주세요." }, { status: 400 });
    const result = await auth.db.from("university_mistakes").update({ reviewed: body.reviewed }).eq("id", String(body.id || "")).eq("user_id", auth.user.id).select("id").maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return NextResponse.json({ message: "기록을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
