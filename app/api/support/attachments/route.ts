import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getActiveSession } from "../../../../lib/active-session";
import { rateLimit, sameOrigin } from "../../../../lib/member-auth";
import { getServerSupabase } from "../../../../lib/supabase-server";

export const dynamic = "force-dynamic";

const BUCKET = "support-request-attachments";
const MAX_SIZE = 4 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "image/heic": "heic", "image/heif": "heif", "application/pdf": "pdf",
};
const fail = (message: string, status: number) => NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });

function matchesType(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((part, index) => bytes[index] === part);
  if (type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (type === "application/pdf") return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (type === "image/heic" || type === "image/heif") {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    return String.fromCharCode(...bytes.slice(4, 8)) === "ftyp" && ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand);
  }
  return false;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return fail("요청 출처를 확인할 수 없습니다.", 403);
  try {
    const session = await getActiveSession(request);
    if (!session) return fail("로그인 후 이용해주세요.", 401);
    const form = await request.formData();
    const requestId = String(form.get("requestId") || "");
    const file = form.get("file");
    if (!UUID.test(requestId) || !(file instanceof File)) return fail("문의와 첨부 파일을 확인해주세요.", 400);
    if (!EXTENSIONS[file.type] || file.size < 1 || file.size > MAX_SIZE) return fail("사진 또는 PDF 파일을 4MB 이하로 첨부해주세요.", 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesType(bytes, file.type)) return fail("파일 형식을 확인해주세요.", 400);
    const db = getServerSupabase();
    const own = await db.from("support_requests").select("id,requester_role,requester_name").eq("id", requestId).maybeSingle();
    if (own.error) throw own.error;
    if (!own.data) return fail("문의를 찾지 못했습니다.", 404);
    const admin = session.role === "teacher" && session.name === "전체 관리자";
    const owner = own.data.requester_role === session.role && own.data.requester_name === session.name;
    if (!admin && !owner) return fail("이 문의에 첨부할 수 없습니다.", 403);
    if (!await rateLimit(request, "support-attachment", 10, `${session.role}:${session.name}`)) return fail("파일 첨부 횟수가 많습니다. 잠시 후 다시 시도해주세요.", 429);
    const previous = await db.from("support_request_attachments").select("id", { count: "exact", head: true }).eq("request_id", requestId);
    if (previous.error) throw previous.error;
    if ((previous.count || 0) >= 5) return fail("문의당 파일은 최대 5개까지 첨부할 수 있습니다.", 400);
    const path = `${requestId}/${randomUUID()}.${EXTENSIONS[file.type]}`;
    const stored = await db.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
    if (stored.error) throw stored.error;
    const inserted = await db.from("support_request_attachments").insert({
      request_id: requestId, uploader_role: session.role, uploader_name: session.name,
      file_name: file.name.slice(0, 120) || `첨부파일.${EXTENSIONS[file.type]}`,
      content_type: file.type, storage_path: path,
    }).select("id,request_id,file_name,content_type,created_at").single();
    if (inserted.error) {
      await db.storage.from(BUCKET).remove([path]);
      throw inserted.error;
    }
    if (owner) {
      const reopened = await db.from("support_requests").update({ status: "open" }).eq("id", requestId);
      if (reopened.error) throw reopened.error;
    }
    return NextResponse.json({ attachment: inserted.data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[support-attachment] upload failed", error instanceof Error ? error.name : "unknown");
    return fail("파일을 첨부하지 못했습니다. 다시 시도해주세요.", 502);
  }
}
