import { NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { setSession } from "../../../../lib/session";
import { hashUniversityPassword, matchesUniversityPassword } from "../../../../lib/university-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const action = String(body.action || "login");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      return NextResponse.json({ message: "이메일과 8자 이상의 비밀번호를 입력해주세요." }, { status: 400 });
    }
    const db = getServerSupabase();
    if (action === "signup") {
      const name = String(body.name || "").trim();
      if (!name || name.length > 60 || password.length > 128) return NextResponse.json({ message: "이름 또는 비밀번호를 확인해주세요." }, { status: 400 });
      const { error } = await db.from("university_users").insert({ email, display_name: name, password_hash: hashUniversityPassword(password) });
      if (error?.code === "23505") return NextResponse.json({ message: "이미 가입된 이메일입니다." }, { status: 409 });
      if (error) throw error;
      return NextResponse.json({ ok: true, message: "가입되었습니다. 로그인해주세요." }, { status: 201 });
    }
    if (action !== "login") return NextResponse.json({ message: "지원하지 않는 요청입니다." }, { status: 400 });
    const { data, error } = await db.from("university_users").select("email,password_hash").eq("email", email).maybeSingle();
    if (error) throw error;
    if (!data || !matchesUniversityPassword(password, data.password_hash)) return NextResponse.json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    const response = NextResponse.json({ ok: true });
    setSession(response, "university", email);
    return response;
  } catch (error) {
    console.error("[university auth] failed", error);
    return NextResponse.json({ message: "대학생 계정을 처리하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}

