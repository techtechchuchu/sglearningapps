import { NextResponse } from "next/server";
import { getServerSupabase } from "../../../../../lib/supabase-server";
import { hashPassword } from "../../../../../lib/student-auth";

const GRADES = new Set(["중3", "고1", "고2", "고3"]);

export async function POST(request: Request) {
  try {
    const { username, password, grade, signupCode } = await request.json();
    const name = String(username || "").trim();
    const pw = String(password || "");
    const code = process.env.STUDENT_SIGNUP_CODE;
    if (!code) return NextResponse.json({ message: "가입 설정을 확인해주세요." }, { status: 503 });
    if (String(signupCode || "") !== code) return NextResponse.json({ message: "학원 가입 코드가 올바르지 않습니다." }, { status: 403 });
    if (!name || pw.length < 4 || !GRADES.has(String(grade))) return NextResponse.json({ message: "이름·학년·비밀번호(4자 이상)를 확인해주세요." }, { status: 400 });
    const db = getServerSupabase();
    const existing = await db.from("users").select("username").eq("username", name).limit(1);
    if (existing.error) throw existing.error;
    if (existing.data?.length) return NextResponse.json({ message: "이미 가입된 이름입니다. 비밀번호 재설정을 요청해주세요." }, { status: 409 });
    const clean = name.replace(/\s+/g, "");
    const names = new Set<string>();
    const rosterNames = new Set<string>();
    for (let start = 0; ; start += 1000) {
      const [users, roster] = await Promise.all([
        db.from("users").select("username").range(start, start + 999),
        db.from("student_roster").select("student_name").range(start, start + 999),
      ]);
      if (users.error || roster.error) throw users.error || roster.error;
      for (const row of users.data || []) names.add(String(row.username || "").replace(/\s+/g, ""));
      for (const row of roster.data || []) rosterNames.add(String(row.student_name || "").replace(/\s+/g, ""));
      if ((users.data || []).length < 1000 && (roster.data || []).length < 1000) break;
    }
    if (names.has(clean)) return NextResponse.json({ message: "이미 가입된 이름입니다. 비밀번호 재설정을 요청해주세요." }, { status: 409 });
    if (!rosterNames.has(clean) && [...names, ...rosterNames].some((candidate) => candidate.length >= 2 && (candidate.includes(clean) || clean.includes(candidate)))) {
      return NextResponse.json({ message: "기존 학생 이름과 비슷합니다. 담당 선생님에게 계정을 확인해주세요." }, { status: 409 });
    }
    const result = await db.from("users").insert({ username: name, password_hash: hashPassword(pw), grade, temp_password: "", created_at: new Date().toISOString() }).select("username").single();
    if (result.error) throw result.error;
    return NextResponse.json({ ok: true, message: "가입되었습니다. 로그인해주세요." }, { status: 201 });
  } catch (error) {
    console.error("[student signup] failed", error);
    return NextResponse.json({ message: "가입에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
