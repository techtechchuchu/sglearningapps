import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../../lib/session";
import { getServerSupabase } from "../../../../../lib/supabase-server";

const PRIVATE_BUCKET = "wrong-note-pdfs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await context.params;
  if (!/^[1-9]\d*$/.test(id)) return NextResponse.json({ message: "파일 번호가 올바르지 않습니다." }, { status: 400 });

  try {
    const db = getServerSupabase();
    const result = await db.from("wrong_note_files")
      .select("id,student_name,teacher_name,storage_path")
      .eq("id", Number(id))
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data?.storage_path) return NextResponse.json({ message: "파일을 찾지 못했습니다." }, { status: 404 });

    const allowed = session.role === "student"
      ? session.name === result.data.student_name
      : session.name === "전체 관리자" || session.name === result.data.teacher_name;
    if (!allowed) return NextResponse.json({ message: "이 파일을 열 권한이 없습니다." }, { status: 403 });

    const signed = await db.storage.from(PRIVATE_BUCKET).createSignedUrl(result.data.storage_path, 60);
    if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error("Missing signed URL");
    const response = NextResponse.redirect(signed.data.signedUrl, 302);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return NextResponse.json({ message: "PDF를 열지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
