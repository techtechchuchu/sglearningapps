import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getServerSupabase } from "../../../../../lib/supabase-server";
import { staffSession } from "../../../../../lib/staff-access";

export const dynamic = "force-dynamic";
const BUCKET = "student-home-banners";
const allowed = (request: NextRequest) => staffSession(request) === "전체 관리자";
const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(request: NextRequest) {
  if (!allowed(request)) return NextResponse.json({ message: "전체 관리자만 이용할 수 있습니다." }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !extensions[file.type] || file.size === 0 || file.size > 3 * 1024 * 1024) return NextResponse.json({ message: "3MB 이하 JPG, PNG, WEBP 이미지를 선택해주세요." }, { status: 400 });
    const path = `${randomUUID()}.${extensions[file.type]}`;
    const db = getServerSupabase();
    const uploaded = await db.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (uploaded.error) throw uploaded.error;
    return NextResponse.json({ imagePath: path, previewUrl: `/api/admin/home-slides/image?path=${encodeURIComponent(path)}` }, { status: 201 });
  } catch (error) {
    console.error("[home-slides] upload failed", error);
    return NextResponse.json({ message: "이미지를 올리지 못했습니다." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!allowed(request)) return NextResponse.json({ message: "전체 관리자만 이용할 수 있습니다." }, { status: 403 });
  const path = request.nextUrl.searchParams.get("path") || "";
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(path)) return NextResponse.json({ message: "이미지를 찾지 못했습니다." }, { status: 404 });
  try {
    const signed = await getServerSupabase().storage.from(BUCKET).createSignedUrl(path, 60);
    if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error("Signed URL missing");
    return NextResponse.redirect(signed.data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ message: "이미지를 열지 못했습니다." }, { status: 500 });
  }
}
