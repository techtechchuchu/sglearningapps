import { NextResponse } from "next/server";
import { getServerSupabase } from "../../../../../lib/supabase-server";

const RECEIVED = "요청을 확인했습니다. 계정이 확인되면 담당 선생님 또는 관리자가 임시 비밀번호를 안내합니다.";

export async function POST(request: Request) {
  try {
    const { username } = await request.json();
    const name = String(username || "").trim();
    if (!name) return NextResponse.json({ message: "학생 이름을 입력해주세요." }, { status: 400 });
    const db = getServerSupabase();
    const user = await db.from("users").select("username,withdrawn_at").eq("username", name).limit(1);
    if (user.error) throw user.error;
    if (!user.data?.length || user.data[0].withdrawn_at) return NextResponse.json({ ok: true, message: RECEIVED });
    const pending = await db.from("password_reset_requests").select("id").eq("username", name).eq("status", "pending").limit(1);
    if (pending.error) throw pending.error;
    if (!pending.data?.length) {
      const inserted = await db.from("password_reset_requests").insert({ username: name, status: "pending", requested_at: new Date().toISOString(), processed_at: null, processed_by: "" });
      if (inserted.error) throw inserted.error;
    }
    return NextResponse.json({ ok: true, message: RECEIVED });
  } catch (error) {
    console.error("[password reset request] failed", error);
    return NextResponse.json({ message: "요청을 접수하지 못했습니다." }, { status: 500 });
  }
}
