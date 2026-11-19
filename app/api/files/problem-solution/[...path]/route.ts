import { NextRequest, NextResponse } from "next/server";
import { getActiveSession } from "../../../../../lib/active-session";
import { getServerSupabase } from "../../../../../lib/supabase-server";

// Exam papers with hand-written solutions live in a private bucket; only signed-in students and teachers
// get a short-lived link. problem_explanations.image_url points here, e.g.
// /api/files/problem-solution/2025-namok-g1-2-final/17.webp
const PRIVATE_BUCKET = "problem-solutions";
const SAFE_PATH = /^[a-z0-9-]{3,80}\/\d{2}\.webp$/;

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const session = await getActiveSession(request);
  if (!session || (session.role !== "student" && session.role !== "teacher")) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const { path } = await context.params;
  const storagePath = (path || []).join("/");
  if (!SAFE_PATH.test(storagePath)) return NextResponse.json({ message: "파일 경로가 올바르지 않습니다." }, { status: 400 });

  try {
    const signed = await getServerSupabase().storage.from(PRIVATE_BUCKET).createSignedUrl(storagePath, 300);
    if (signed.error || !signed.data?.signedUrl) {
      console.error("[problem solution] signed url failed", storagePath, signed.error?.message);
      const bucketMissing = /bucket/i.test(signed.error?.message || "");
      return NextResponse.json({ message: bucketMissing ? `저장소에 '${PRIVATE_BUCKET}' 버킷이 없습니다.` : `버킷에 이 파일이 없습니다: ${storagePath}` }, { status: 404 });
    }
    const response = NextResponse.redirect(signed.data.signedUrl, 302);
    response.headers.set("Cache-Control", "private, max-age=240");
    return response;
  } catch {
    return NextResponse.json({ message: "풀이 이미지를 열지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
