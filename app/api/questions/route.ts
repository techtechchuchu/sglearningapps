import { NextRequest, NextResponse } from "next/server";
import { getActiveSession } from "../../../lib/active-session";
import { getServerSupabase } from "../../../lib/supabase-server";

const fail = (message: string, status: number) => NextResponse.json({ message }, { status });
const fields = "id,student_name,teacher_name,class_name,question,problem_ref,answer,status,created_at,answered_at,resolved_at";

export async function GET(request: NextRequest) {
  try {
    const session = await getActiveSession(request);
    if (!session) return fail("로그인이 필요합니다.", 401);
    const db = getServerSupabase();
    let query = db.from("student_questions").select(fields).order("created_at", { ascending: false }).limit(200);
    if (session.role === "student") query = query.eq("student_name", session.name);
    else if (session.name !== "전체 관리자") query = query.eq("teacher_name", session.name);
    const result = await query;
    if (result.error) throw result.error;
    return NextResponse.json({ questions: result.data || [] });
  } catch (error) {
    console.error("[questions GET]", error);
    return fail("질문함을 불러오지 못했습니다. 데이터베이스 설정을 확인해주세요.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getActiveSession(request);
    if (session?.role !== "student") return fail("학생 로그인 후 이용할 수 있습니다.", 403);
    const body = await request.json();
    const teacherName = String(body.teacherName || "").trim();
    const className = String(body.className || "").trim();
    const question = String(body.question || "").trim();
    const problemRef = String(body.problemRef || "").trim();
    if (!teacherName || !className || question.length < 5 || question.length > 2000 || problemRef.length > 120) return fail("담당 반과 질문 내용(5~2000자)을 확인해주세요.", 400);
    const db = getServerSupabase();
    const roster = await db.from("student_roster").select("id,enrollment_status").eq("student_name", session.name).eq("teacher_name", teacherName).eq("class_name", className).limit(100);
    if (roster.error) throw roster.error;
    if (!roster.data?.some((row) => row.enrollment_status !== "퇴원")) return fail("등록된 반의 선생님에게만 질문할 수 있습니다.", 403);
    const result = await db.from("student_questions").insert({ student_name: session.name, teacher_name: teacherName, class_name: className, question, problem_ref: problemRef || null }).select("id").single();
    if (result.error) throw result.error;
    return NextResponse.json({ id: result.data.id }, { status: 201 });
  } catch (error) {
    console.error("[questions POST]", error);
    return fail("질문을 저장하지 못했습니다. 다시 시도해주세요.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getActiveSession(request);
    if (!session) return fail("로그인이 필요합니다.", 401);
    const body = await request.json();
    const id = Number(body.id);
    if (!Number.isSafeInteger(id) || id <= 0) return fail("질문 번호가 올바르지 않습니다.", 400);
    const db = getServerSupabase();
    if (session.role === "student") {
      if (body.action !== "resolve") return fail("지원하지 않는 요청입니다.", 403);
      const result = await db.from("student_questions").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id).eq("student_name", session.name).eq("status", "answered").select("id").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return fail("답변을 받은 본인 질문만 해결 완료할 수 있습니다.", 404);
    } else {
      const answer = String(body.answer || "").trim();
      if (answer.length < 2 || answer.length > 4000) return fail("답변은 2~4000자로 작성해주세요.", 400);
      let query = db.from("student_questions").update({ answer, status: "answered", answered_at: new Date().toISOString(), resolved_at: null }).eq("id", id);
      if (session.name !== "전체 관리자") query = query.eq("teacher_name", session.name);
      const result = await query.select("id").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return fail("담당 질문을 찾지 못했습니다.", 404);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[questions PATCH]", error);
    return fail("질문 상태를 저장하지 못했습니다.", 500);
  }
}

