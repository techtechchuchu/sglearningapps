import { NextResponse } from "next/server";
import { setSession } from "../../../../lib/session";

const TEACHERS = ["이주백.T", "박병민.T", "노대근.T"];
const ALL_TEACHER_ADMIN = "전체 관리자";

export async function POST(request: Request) {
  try {
  const { teacher, password } = await request.json();
  const name = String(teacher || "").trim();
  const pw = String(password || "");

  if (![...TEACHERS, ALL_TEACHER_ADMIN].includes(name)) {
    return NextResponse.json({ ok: false, message: "선생님을 선택해주세요." }, { status: 400 });
  }

  // The Streamlit app uses separate secrets for teachers and the full administrator.
  const expected = name === ALL_TEACHER_ADMIN
    ? process.env.SUPERADMIN_PASSWORD
    : process.env.ADMIN_PASSWORD;

  if (!expected) {
    return NextResponse.json({ ok: false, message: "로그인 설정이 완료되지 않았습니다. 관리자에게 문의해주세요." }, { status: 503 });
  }

  if (pw !== expected) {
    return NextResponse.json({ ok: false, message: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, teacher: name });
  setSession(response, "teacher", name);
  return response;
  } catch (error) {
    console.error("[teacher login] failed", error);
    return NextResponse.json({ ok: false, message: "서버 로그인 설정 오류입니다. SESSION_SECRET 설정을 확인해주세요." }, { status: 503 });
  }
}
