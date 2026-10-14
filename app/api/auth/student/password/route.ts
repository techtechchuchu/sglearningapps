import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../../lib/session";
import { getServerSupabase } from "../../../../../lib/supabase-server";
import { hashPassword, passwordMatches } from "../../../../../lib/student-auth";

export async function POST(request: NextRequest) {
  try {
    const session = getSession(request);
    if (session?.role !== "student") return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    const { currentPassword, newPassword } = await request.json();
    const current = String(currentPassword || "");
    const next = String(newPassword || "");
    if (next.length < 4) return NextResponse.json({ message: "새 비밀번호는 4자 이상 입력해주세요." }, { status: 400 });
    const db = getServerSupabase();
    const user = await db.from("users").select("password_hash").eq("username", session.name).limit(1).single();
    if (user.error) throw user.error;
    if (!passwordMatches(current, user.data.password_hash)) return NextResponse.json({ message: "현재 비밀번호가 올바르지 않습니다." }, { status: 401 });
    const changed = await db.from("users").update({ password_hash: hashPassword(next), temp_password: "" }).eq("username", session.name).select("username").single();
    if (changed.error) throw changed.error;
    return NextResponse.json({ ok: true, message: "비밀번호가 변경되었습니다." });
  } catch (error) {
    console.error("[student password] failed", error);
    return NextResponse.json({ message: "비밀번호를 변경하지 못했습니다." }, { status: 500 });
  }
}
