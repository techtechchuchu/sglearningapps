import { NextResponse } from "next/server";
import { setSession } from "../../../../lib/session";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { passwordMatches } from "../../../../lib/student-auth";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const loginName = String(username || "").trim();
    const loginPassword = String(password || "");

    if (!loginName || !loginPassword) {
      return NextResponse.json({ ok: false, message: "아이디(기존 회원은 학생 이름)와 비밀번호를 입력해주세요." }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const byName = await supabase
      .from("users")
      .select("username,password_hash,grade,temp_password,withdrawn_at,signup_status")
      .eq("username", loginName)
      .limit(1)
      .maybeSingle();
    if (byName.error) throw byName.error;
    const byId = !byName.data ? await supabase
      .from("users")
      .select("username,password_hash,grade,temp_password,withdrawn_at,signup_status")
      .eq("login_id", loginName.toLowerCase())
      .limit(1)
      .maybeSingle() : null;
    if (byId?.error) throw byId.error;
    const data = byName.data || byId?.data;

    if (!data || !passwordMatches(loginPassword, data.password_hash)) {
      return NextResponse.json({ ok: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
    if (data.withdrawn_at) return NextResponse.json({ ok: false, message: "탈퇴한 계정입니다. 관리자에게 문의해주세요." }, { status: 403 });
    if (data.signup_status !== "approved") return NextResponse.json({ ok: false, message: data.signup_status === "pending" ? "가입 승인 대기 중입니다. 관리자 승인을 기다려주세요." : "가입 신청이 반려됐습니다. 관리자에게 문의하거나 가입코드로 다시 신청해주세요." }, { status: 403 });

    const response = NextResponse.json({
      ok: true,
      user: {
        username: data.username,
        grade: data.grade,
        tempPassword: Boolean(data.temp_password),
      },
    });
    setSession(response, "student", data.username);
    return response;
  } catch (error) {
    console.error("[student login] failed", error);
    return NextResponse.json(
      { ok: false, message: "로그인 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
