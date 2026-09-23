import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

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
      .select("username,password_hash,grade,temp_password")
      .eq("username", loginName)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const hash = createHash("sha256").update(loginPassword, "utf8").digest("hex");
    if (!data || data.password_hash !== hash) {
      return NextResponse.json({ ok: false, message: "학생 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      user: {
        username: data.username,
        grade: data.grade,
        tempPassword: Boolean(data.temp_password),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: "로그인 처리 중 오류가 발생했습니다.", detail: String(error) },
      { status: 500 },
    );
  }
}
