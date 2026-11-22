import { NextRequest, NextResponse } from "next/server";
import { getActiveSession } from "../../../../../lib/active-session";
import { getServerSupabase } from "../../../../../lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession(request);
  if (!session) return new NextResponse("로그인이 필요합니다.", { status: 401 });
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("파일을 찾지 못했습니다.", { status: 404 });
    const db = getServerSupabase();
    const attachment = await db.from("support_request_attachments").select("storage_path,request_id").eq("id", id).maybeSingle();
    if (attachment.error) throw attachment.error;
    if (!attachment.data) return new NextResponse("파일을 찾지 못했습니다.", { status: 404 });
    const support = await db.from("support_requests").select("requester_role,requester_name").eq("id", attachment.data.request_id).maybeSingle();
    if (support.error) throw support.error;
    const admin = session.role === "teacher" && session.name === "전체 관리자";
    const owner = support.data?.requester_role === session.role && support.data?.requester_name === session.name;
    if (!admin && !owner) return new NextResponse("파일을 열 수 없습니다.", { status: 403 });
    const signed = await db.storage.from("support-request-attachments").createSignedUrl(attachment.data.storage_path, 60);
    if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error("Signed URL missing");
    return NextResponse.redirect(signed.data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[support-attachment] view failed", error instanceof Error ? error.name : "unknown");
    return new NextResponse("파일을 열지 못했습니다.", { status: 502 });
  }
}
