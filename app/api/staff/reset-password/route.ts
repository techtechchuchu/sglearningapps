import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { hashPassword } from "../../../../lib/student-auth";
import { canManageStudent, staffSession } from "../../../../lib/staff-access";

export async function POST(request: NextRequest) {
  try {
    const teacher = staffSession(request);
    if (!teacher) return NextResponse.json({ message: "선생님 로그인이 필요합니다." }, { status: 401 });
    const { username, password } = await request.json();
    const name = String(username || "").trim();
    const pw = String(password || "").trim();
    if (!name || pw.length < 4) return NextResponse.json({ message: "학생과 4자 이상의 임시 비밀번호를 입력해주세요." }, { status: 400 });
    const db = getServerSupabase();
    if (!await canManageStudent(db, teacher, name)) return NextResponse.json({ message: "담당 학생만 처리할 수 있습니다." }, { status: 403 });
    const updated = await db.from("users").update({ password_hash: hashPassword(pw), temp_password: pw }).eq("username", name).select("username");
    if (updated.error) throw updated.error;
    if (!updated.data?.length) return NextResponse.json({ message: "가입된 학생 계정을 찾지 못했습니다." }, { status: 404 });
    const pending = await db.from("password_reset_requests").update({ status: "completed", processed_at: new Date().toISOString(), processed_by: teacher }).eq("username", name).eq("status", "pending");
    if (pending.error) console.error("[reset request completion] failed", pending.error);
    return NextResponse.json({ ok: true, message: `${name} 학생의 임시 비밀번호를 발급했습니다.` });
  } catch (error) {
    console.error("[staff password reset] failed", error);
    return NextResponse.json({ message: "비밀번호 초기화에 실패했습니다." }, { status: 500 });
  }
}
