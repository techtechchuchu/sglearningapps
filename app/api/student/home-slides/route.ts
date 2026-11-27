import { NextRequest, NextResponse } from "next/server";
import { getActiveSession } from "../../../../lib/active-session";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { withinPublicationWindow } from "../../../../lib/home-slides";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getActiveSession(request);
  if (!session || session.role !== "student") return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  try {
    const db = getServerSupabase();
    const [slideResult, noticeResult] = await Promise.all([
      db.from("student_home_slides").select("id,published,display_order,is_active").eq("is_active", true).order("display_order").order("id"),
      db.from("notices").select("id,title,content,priority,starts_at,ends_at").eq("is_active", true).in("target", ["all", "student"]).order("priority", { ascending: false }),
    ]);
    if (slideResult.error || noticeResult.error) throw slideResult.error || noticeResult.error;
    const now = new Date();
    const noticeSlides = (noticeResult.data || []).filter((row) => withinPublicationWindow({ startsAt: row.starts_at, endsAt: row.ends_at }, now)).map((row) => ({
      id: `notice-${row.id}`, kind: "notice", title: row.title, description: row.content, eyebrow: "공지사항",
    }));
    const slides = (slideResult.data || []).filter((row) => row.published && withinPublicationWindow(row.published, now)).map((row) => ({
      id: `slide-${row.id}`, kind: row.published.kind, title: row.published.title, description: row.published.description,
      eyebrow: row.published.eyebrow, image: row.published.imagePath ? `/api/student/home-slides/${row.id}/image` : row.published.imageUrl,
      url: row.published.linkUrl || "",
    }));
    return NextResponse.json({ slides: [...noticeSlides, ...slides] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[home-slides] student list failed", error);
    return NextResponse.json({ message: "공지를 불러오지 못했습니다." }, { status: 500 });
  }
}
