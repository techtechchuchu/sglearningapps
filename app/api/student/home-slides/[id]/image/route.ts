import { NextRequest, NextResponse } from "next/server";
import { getActiveSession } from "../../../../../../lib/active-session";
import { getServerSupabase } from "../../../../../../lib/supabase-server";
import { withinPublicationWindow } from "../../../../../../lib/home-slides";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession(request);
  if (!session || session.role !== "student") return new NextResponse("로그인이 필요합니다.", { status: 401 });
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) return new NextResponse("이미지를 찾지 못했습니다.", { status: 404 });
  try {
    const db = getServerSupabase();
    const result = await db.from("student_home_slides").select("published,is_active").eq("id", Number(id)).maybeSingle();
    if (result.error) throw result.error;
    const slide = result.data;
    if (!slide?.is_active || !slide.published?.imagePath || !withinPublicationWindow(slide.published)) return new NextResponse("이미지를 찾지 못했습니다.", { status: 404 });
    const signed = await db.storage.from("student-home-banners").createSignedUrl(slide.published.imagePath, 60);
    if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error("Signed URL missing");
    return NextResponse.redirect(signed.data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[home-slides] student image failed", error);
    return new NextResponse("이미지를 열지 못했습니다.", { status: 500 });
  }
}
