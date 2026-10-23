import { NextRequest, NextResponse } from "next/server";
import { failure, sameOrigin } from "../../../../lib/member-auth";
import { SESSION_COOKIE } from "../../../../lib/session";
import { getActiveSession } from "../../../../lib/active-session";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { passwordMatches } from "../../../../lib/student-auth";
import { matchesUniversityPassword } from "../../../../lib/university-auth";

function normalizePhone(value: unknown) {
  const input = String(value ?? "").trim();
  if (!input) return "";
  if (!/^[0-9 -]{10,20}$/.test(input)) return null;
  const digits = input.replace(/\D/g, "");
  return /^0\d{9,10}$/.test(digits) ? digits : null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getActiveSession(request);
    if (!session || session.role === "teacher") return failure("로그인이 필요합니다.", 401);
    const db = getServerSupabase();
    if (session.role === "student") {
      const [user, roster] = await Promise.all([
        db.from("users").select("username,login_id,email,phone,grade").eq("username", session.name).single(),
        db.from("student_roster").select("school_name,grade,class_name,teacher_name,enrollment_status").eq("student_name", session.name).order("created_at", { ascending: false }).limit(100),
      ]);
      if (user.error || roster.error) throw user.error || roster.error;
      const current = (roster.data || []).find((row) => row.enrollment_status !== "퇴원") || roster.data?.[0];
      return NextResponse.json({ role: "student", name: user.data.username, loginId: user.data.login_id || "", email: user.data.email || "", phone: user.data.phone || "", school: current?.school_name || "", grade: current?.grade || user.data.grade || "", className: current?.class_name || "", schoolEditable: false }, { headers: { "Cache-Control": "no-store" } });
    }
    const user = await db.from("university_users").select("id,email,display_name,school,grade,phone,academy_username").eq(session.role === "member" ? "id" : "email", session.name).single();
    if (user.error) throw user.error;
    const roster = user.data.academy_username
      ? await db.from("student_roster").select("school_name,grade,class_name,enrollment_status").eq("student_name", user.data.academy_username).order("created_at", { ascending: false }).limit(100)
      : null;
    if (roster?.error) throw roster.error;
    const current = roster?.data?.find((row) => row.enrollment_status !== "퇴원") || roster?.data?.[0];
    return NextResponse.json({ role: "member", name: user.data.display_name || "", email: user.data.email || "", phone: user.data.phone || "", school: current?.school_name || user.data.school || "", grade: current?.grade || user.data.grade || "", className: current?.class_name || "", schoolEditable: !user.data.academy_username, academyConnected: Boolean(user.data.academy_username) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return failure("계정 정보를 불러오지 못했습니다."); }
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return failure("잘못된 요청입니다.", 403);
  try {
    const session = await getActiveSession(request);
    if (!session || session.role === "teacher") return failure("로그인이 필요합니다.", 401);
    const body = await request.json();
    const phone = normalizePhone(body.phone);
    if (phone === null) return failure("휴대전화 번호를 확인해주세요. 숫자 10~11자리로 입력하거나 비워두세요.", 400);
    const db = getServerSupabase();
    if (session.role === "student") {
      const result = await db.from("users").update({ phone }).eq("username", session.name).is("withdrawn_at", null).select("username").single();
      if (result.error) throw result.error;
    } else {
      const query = db.from("university_users").select("id,academy_username").eq(session.role === "member" ? "id" : "email", session.name).single();
      const user = await query;
      if (user.error) throw user.error;
      const changes: { phone: string; school?: string } = { phone };
      if (body.school !== undefined) {
        if (user.data.academy_username) return failure("학원 연결 회원의 학교는 명단에서 확인해주세요.", 403);
        const school = String(body.school).trim();
        if (school.length > 120) return failure("학교 이름은 120자 이하로 입력해주세요.", 400);
        changes.school = school;
      }
      const result = await db.from("university_users").update(changes).eq("id", user.data.id).is("withdrawn_at", null);
      if (result.error) throw result.error;
    }
    return NextResponse.json({ ok: true, message: "계정 정보를 저장했습니다." });
  } catch { return failure("계정 정보를 저장하지 못했습니다."); }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return failure("잘못된 요청입니다.", 403);
  try {
    const session = await getActiveSession(request);
    if (!session || session.role === "teacher") return failure("로그인이 필요합니다.", 401);
    const body = await request.json();
    if (body.confirmation !== "탈퇴") return failure("확인란에 ‘탈퇴’를 입력해주세요.", 400);
    const db = getServerSupabase();
    if (session.role === "student") {
      const user = await db.from("users").select("password_hash").eq("username", session.name).single();
      if (user.error) throw user.error;
      if (!passwordMatches(String(body.password || ""), user.data.password_hash)) return failure("현재 비밀번호를 확인해주세요.", 403);
      const result = await db.from("users").update({ withdrawn_at: new Date().toISOString(), phone: "" }).eq("username", session.name).is("withdrawn_at", null).select("username").single();
      if (result.error) throw result.error;
    } else {
      const user = await db.from("university_users").select("id,password_hash").eq(session.role === "member" ? "id" : "email", session.name).single();
      if (user.error) throw user.error;
      if (user.data.password_hash) {
        if (!matchesUniversityPassword(String(body.password || ""), user.data.password_hash)) return failure("현재 비밀번호를 확인해주세요.", 403);
      } else if (!session.issuedAt || Date.now() / 1000 - session.issuedAt > 300) {
        return failure("안전을 위해 다시 로그인한 뒤 5분 안에 탈퇴를 진행해주세요.", 403);
      }
      const result = await db.from("university_users").update({ withdrawn_at: new Date().toISOString(), phone: "" }).eq("id", user.data.id).is("withdrawn_at", null).select("id").single();
      if (result.error) throw result.error;
    }
    const response = NextResponse.json({ ok: true, message: "계정이 탈퇴 회원으로 이동했습니다. 학습·출석 기록은 삭제되지 않았습니다." });
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch { return failure("탈퇴 처리에 실패했습니다. 다시 시도해주세요."); }
}
