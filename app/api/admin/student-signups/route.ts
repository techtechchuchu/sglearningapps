import { NextRequest, NextResponse } from "next/server";
import { failure, sameOrigin } from "../../../../lib/member-auth";
import { staffSession } from "../../../../lib/staff-access";
import { getServerSupabase } from "../../../../lib/supabase-server";

function isAdmin(request: NextRequest) { return staffSession(request) === "전체 관리자"; }

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return failure("전체 관리자만 가입 신청을 확인할 수 있습니다.", 403);
  try {
    const result = await getServerSupabase().from("users")
      .select("username,login_id,grade,email,phone,created_at")
      .eq("signup_status", "pending")
      .order("created_at", { ascending: true })
      .limit(500);
    if (result.error) throw result.error;
    return NextResponse.json({ requests: result.data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return failure("가입 신청을 불러오지 못했습니다.");
  }
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return failure("잘못된 요청입니다.", 403);
  if (!isAdmin(request)) return failure("전체 관리자만 가입을 승인할 수 있습니다.", 403);
  try {
    const body = await request.json();
    const username = String(body.username || "").trim();
    if (!username || username.length > 60 || typeof body.approve !== "boolean") return failure("신청 학생과 처리 내용을 확인해주세요.", 400);
    const db = getServerSupabase();
    if (body.approve) {
      const applicant = await db.from("users").select("grade").eq("username", username).eq("signup_status", "pending").maybeSingle();
      if (applicant.error) throw applicant.error;
      if (!applicant.data) return failure("이미 처리됐거나 없는 가입 신청입니다.", 409);
      const roster = await db.from("student_roster").select("id,grade").eq("student_name", username).neq("enrollment_status", "퇴원").limit(20);
      if (roster.error) throw roster.error;
      if (!roster.data?.some(row => !row.grade || row.grade === applicant.data.grade))
        return failure("동일한 이름·학년의 재원 명단이 없습니다. 먼저 명단에 등록하거나 학년을 확인해주세요.", 409);
    }
    const result = await db.from("users").update({
      signup_status: body.approve ? "approved" : "rejected",
      signup_reviewed_at: new Date().toISOString(),
      signup_reviewer: "전체 관리자",
    }).eq("username", username).eq("signup_status", "pending").select("username");
    if (result.error) throw result.error;
    if (!result.data?.length) return failure("이미 처리됐거나 없는 가입 신청입니다.", 409);
    return NextResponse.json({ ok: true, message: body.approve ? "학생 가입을 승인했습니다." : "학생 가입을 반려했습니다." }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return failure("가입 신청을 처리하지 못했습니다.");
  }
}
