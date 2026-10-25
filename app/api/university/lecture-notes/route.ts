import { NextRequest, NextResponse } from "next/server";
import { memberContext, sameOrigin } from "../../../../lib/member-auth";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers });

async function universityUser(request: NextRequest) {
  const auth = await memberContext(request);
  return auth?.user.onboarding_complete && !auth.user.withdrawn_at && auth.user.learner_type === "university" ? auth : null;
}

function parseTranscript(value: unknown) {
  if (!Array.isArray(value) || value.length > 1200) return null;
  const rows: { at: number; text: string }[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const { at, text } = item as Record<string, unknown>;
    if (typeof at !== "number" || !Number.isFinite(at) || at < 0 || at > 14400 || typeof text !== "string" || text.trim().length > 500) return null;
    if (text.trim()) rows.push({ at: Math.round(at), text: text.trim() });
  }
  if (JSON.stringify(rows).length > 150000) return null;
  return rows;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await universityUser(request);
    if (!auth) return reply({ message: "대학생 계정으로 로그인해주세요." }, 401);
    const result = await auth.db.from("university_lecture_notes")
      .select("id,course_id,title,transcript,summary,created_at,updated_at")
      .eq("user_id", auth.user.id).order("updated_at", { ascending: false }).limit(100);
    if (result.error) throw result.error;
    return reply({ notes: result.data });
  } catch (error) {
    console.error("[university lecture notes] list failed", error);
    return reply({ message: "강의 노트를 불러오지 못했습니다." }, 500);
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ message: "요청 출처를 확인할 수 없습니다." }, 403);
  try {
    const auth = await universityUser(request);
    if (!auth) return reply({ message: "대학생 계정으로 로그인해주세요." }, 401);
    const body = await request.json();
    const courseId = String(body.courseId || "");
    const title = String(body.title || "").trim();
    const summary = String(body.summary || "").trim();
    const transcript = parseTranscript(body.transcript);
    if (!title || title.length > 120 || summary.length > 12000 || !transcript) return reply({ message: "제목 또는 노트 내용을 확인해주세요." }, 400);
    const course = await auth.db.from("university_courses").select("id").eq("id", courseId).eq("user_id", auth.user.id).maybeSingle();
    if (course.error) throw course.error;
    if (!course.data) return reply({ message: "내 과목을 선택해주세요." }, 400);
    const result = await auth.db.from("university_lecture_notes")
      .insert({ user_id: auth.user.id, course_id: courseId, title, transcript, summary })
      .select("id").single();
    if (result.error) throw result.error;
    return reply({ id: result.data.id }, 201);
  } catch (error) {
    console.error("[university lecture notes] create failed", error);
    return reply({ message: "강의 노트를 저장하지 못했습니다." }, 500);
  }
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ message: "요청 출처를 확인할 수 없습니다." }, 403);
  try {
    const auth = await universityUser(request);
    if (!auth) return reply({ message: "대학생 계정으로 로그인해주세요." }, 401);
    const body = await request.json();
    const id = String(body.id || "");
    const title = String(body.title || "").trim();
    const summary = String(body.summary || "").trim();
    const transcript = parseTranscript(body.transcript);
    if (!title || title.length > 120 || summary.length > 12000 || !transcript) return reply({ message: "제목 또는 노트 내용을 확인해주세요." }, 400);
    const result = await auth.db.from("university_lecture_notes")
      .update({ title, transcript, summary, updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", auth.user.id).select("id").maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return reply({ message: "노트를 찾을 수 없습니다." }, 404);
    return reply({ ok: true });
  } catch (error) {
    console.error("[university lecture notes] update failed", error);
    return reply({ message: "강의 노트를 수정하지 못했습니다." }, 500);
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ message: "요청 출처를 확인할 수 없습니다." }, 403);
  try {
    const auth = await universityUser(request);
    if (!auth) return reply({ message: "대학생 계정으로 로그인해주세요." }, 401);
    const id = request.nextUrl.searchParams.get("id") || "";
    const result = await auth.db.from("university_lecture_notes").delete().eq("id", id).eq("user_id", auth.user.id).select("id").maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return reply({ message: "노트를 찾을 수 없습니다." }, 404);
    return reply({ ok: true });
  } catch (error) {
    console.error("[university lecture notes] delete failed", error);
    return reply({ message: "강의 노트를 삭제하지 못했습니다." }, 500);
  }
}

