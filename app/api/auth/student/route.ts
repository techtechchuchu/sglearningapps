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
      return NextResponse.json({ ok: false, message: "학생과 비밀번호를 입력해주세요." }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("users")
      .select("username,password_hash,grade,temp_password,withdrawn_at")
      .eq("username", loginName)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data || !passwordMatches(loginPassword, data.password_hash)) {
      return NextResponse.json({ ok: false, message: "학생 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
    if (data.withdrawn_at) return NextResponse.json({ ok: false, message: "탈퇴한 계정입니다. 관리자에게 문의해주세요." }, { status: 403 });

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
