import { NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { setSession } from "../../../../lib/session";
import { matchesUniversityPassword } from "../../../../lib/university-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const action = String(body.action || "login");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (password.length < 8 || password.length > 128)) {
      return NextResponse.json({ message: "이메일과 8자 이상의 비밀번호를 입력해주세요." }, { status: 400 });
    }
    const db = getServerSupabase();
    if (action === "signup") return NextResponse.json({ message: "새 가입은 카카오 또는 이메일 인증 가입을 이용해주세요." }, { status: 400 });

    if (action !== "login") return NextResponse.json({ message: "지원하지 않는 요청입니다." }, { status: 400 });
    const { data, error } = await db.from("university_users").select("email,password_hash").eq("email", email).maybeSingle();
    if (error) throw error;
    if (!data || !data.password_hash || !matchesUniversityPassword(password, data.password_hash)) return NextResponse.json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    const response = NextResponse.json({ ok: true });
    setSession(response, "university", email);
    return response;
  } catch (error) {
    console.error("[university auth] failed", error);
    return NextResponse.json({ message: "대학생 계정을 처리하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
