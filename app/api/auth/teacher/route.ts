import { NextResponse } from "next/server";
import { setSession } from "../../../../lib/session";

const TEACHERS = ["이주백.T", "박병민.T", "노대근.T"];
const ALL_TEACHER_ADMIN = "전체 관리자";

export async function POST(request: Request) {
  const { teacher, password } = await request.json();
  const name = String(teacher || "").trim();
  const pw = String(password || "");

  if (![...TEACHERS, ALL_TEACHER_ADMIN].includes(name)) {
    return NextResponse.json({ ok: false, message: "선생님을 선택해주세요." }, { status: 400 });
  }

  const expected = name === ALL_TEACHER_ADMIN
    ? process.env.SUPERADMIN_PASSWORD
    : process.env.ADMIN_PASSWORD;

  if (!expected) {
    return NextResponse.json({ ok: false, message: "Vercel 환경변수에 선생님 비밀번호가 아직 설정되지 않았습니다." }, { status: 503 });
  }

  if (pw !== expected) {
    return NextResponse.json({ ok: false, message: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, teacher: name });
  setSession(response, "teacher", name);
  return response;
}
