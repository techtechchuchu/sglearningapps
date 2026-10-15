import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../lib/session";
import { getServerSupabase } from "../../../lib/supabase-server";

const ADMIN = "전체 관리자";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
// Fixed classroom poster for the attendance demo only. Rotate this hash and reprint the QR if copied.
const DEMO_QR_HASH = "c50d4a60cd6aceddcb9e987017d2729185b4491acab7cc818d51125287c9e3fe";

function todayKst() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function codeHash(teacher: string, className: string, date: string, code: string) {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing attendance signing secret");
  return createHmac("sha256", secret).update(`${teacher}\0${className}\0${date}\0${code}`).digest("hex");
}

function error(message: string, status: number) { return NextResponse.json({ ok: false, message }, { status }); }

export async function GET(request: NextRequest) {
  try {
    const session = getSession(request);
    if (!session) return error("로그인이 필요합니다.", 401);
    const db = getServerSupabase();
    if (session.role === "student") {
      const records = await db.from("attendance_records")
        .select("id,teacher_name,class_name,attendance_date,status,check_in_at,reviewed_at")
        .eq("student_name", session.name).order("attendance_date", { ascending: false }).limit(180);
      if (records.error) throw records.error;
      return NextResponse.json({ ok: true, records: records.data || [] });
    }
    const date = request.nextUrl.searchParams.get("date") || todayKst();
    if (!DAY_RE.test(date) || Number.isNaN(Date.parse(date))) return error("날짜 형식을 확인해주세요.", 400);
    let query = db.from("attendance_records")
      .select("id,student_name,teacher_name,class_name,attendance_date,status,check_in_at,reviewed_by,reviewed_at")
      .eq("attendance_date", date);
    if (session.name !== ADMIN) query = query.eq("teacher_name", session.name);
    const records = await query.order("class_name").order("student_name");
    if (records.error) throw records.error;
    let codesQuery = db.from("attendance_codes").select("teacher_name,class_name,attendance_date,created_at").eq("attendance_date", date);
    if (session.name !== ADMIN) codesQuery = codesQuery.eq("teacher_name", session.name);
    const codes = await codesQuery;
    if (codes.error) throw codes.error;
    return NextResponse.json({ ok: true, records: records.data || [], activeCodes: codes.data || [] });
  } catch (cause) {
    console.error("[attendance GET]", cause);
    return error("출석 기록을 불러오지 못했습니다. 출석 테이블 설정을 확인해주세요.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSession(request);
    if (!session) return error("로그인이 필요합니다.", 401);
    const body = await request.json();
    const db = getServerSupabase();
    const date = todayKst();
    const className = String(body.className || "").trim();
    const teacherName = String(body.teacherName || "").trim();
    if (!className || !teacherName || className.length > 150 || teacherName.length > 100) return error("반과 담당 선생님을 확인해주세요.", 400);

    if (session.role === "teacher" && body.action === "createCode") {
      if (session.name !== ADMIN && teacherName !== session.name) return error("담당 반만 관리할 수 있습니다.", 403);
      const roster = await db.from("student_roster").select("id,enrollment_status").eq("teacher_name", teacherName).eq("class_name", className).limit(100);
      if (roster.error) throw roster.error;
      if (!roster.data?.some((row) => row.enrollment_status !== "퇴원")) return error("재원 학생이 있는 반만 코드를 만들 수 있습니다.", 404);
      const code = String(randomInt(100000, 1000000));
      const result = await db.from("attendance_codes").upsert({ teacher_name: teacherName, class_name: className, attendance_date: date, code_hash: codeHash(teacherName, className, date, code), created_at: new Date().toISOString() }, { onConflict: "teacher_name,class_name,attendance_date" }).select("id").single();
      if (result.error) throw result.error;
      return NextResponse.json({ ok: true, code, date, message: "오늘의 출석 코드를 만들었습니다. 학생에게 교실에서만 알려주세요." });
    }

    if (session.role !== "student" || body.action !== "checkIn") return error("지원하지 않는 요청입니다.", 403);
    const code = String(body.code || "").trim();
    const qrToken = String(body.qrToken || "").trim();
    const fixedDemoQr = teacherName === ADMIN && className === "출석 데모반" && /^[A-Za-z0-9_-]{32}$/.test(qrToken);
    if (!fixedDemoQr && !/^\d{6}$/.test(code)) return error("출석 QR을 스캔하거나 6자리 코드를 입력해주세요.", 400);
    const roster = await db.from("student_roster").select("id,enrollment_status").eq("student_name", session.name).eq("teacher_name", teacherName).eq("class_name", className).limit(100);
    if (roster.error) throw roster.error;
    if (!roster.data?.some((row) => row.enrollment_status !== "퇴원")) return error("등록된 반에서만 출석 체크할 수 있습니다.", 403);
    if (fixedDemoQr) {
      const supplied = createHash("sha256").update(qrToken).digest("hex");
      if (!timingSafeEqual(Buffer.from(DEMO_QR_HASH, "hex"), Buffer.from(supplied, "hex"))) return error("출석 데모반 QR이 유효하지 않습니다.", 403);
    } else {
      const codeRow = await db.from("attendance_codes").select("code_hash").eq("teacher_name", teacherName).eq("class_name", className).eq("attendance_date", date).maybeSingle();
      if (codeRow.error) throw codeRow.error;
      if (!codeRow.data) return error("오늘의 출석 코드가 아직 열리지 않았습니다.", 409);
      const expected = Buffer.from(codeRow.data.code_hash, "hex");
      const supplied = Buffer.from(codeHash(teacherName, className, date, code), "hex");
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return error("출석 코드가 일치하지 않습니다.", 403);
    }
    const accuracy = Number(body.accuracy);
    const accuracyValue = Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 100000 ? Math.round(accuracy) : null;
    const existing = await db.from("attendance_records").select("id,status").eq("student_name", session.name).eq("teacher_name", teacherName).eq("class_name", className).eq("attendance_date", date).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      if (fixedDemoQr && existing.data.status === "pending") {
        const updated = await db.from("attendance_records").update({ status: "present", reviewed_by: "출석 데모반 QR", reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", existing.data.id);
        if (updated.error) throw updated.error;
        return NextResponse.json({ ok: true, status: "present", message: "출석이 완료되었습니다." });
      }
      return NextResponse.json({ ok: true, alreadyCheckedIn: true, status: existing.data.status, message: "오늘 출석이 이미 기록되어 있습니다." });
    }
    const status = fixedDemoQr ? "present" : "pending";
    const inserted = await db.from("attendance_records").insert({ student_name: session.name, teacher_name: teacherName, class_name: className, attendance_date: date, status, check_in_at: new Date().toISOString(), location_accuracy_m: accuracyValue, ...(fixedDemoQr ? { reviewed_by: "출석 데모반 QR", reviewed_at: new Date().toISOString() } : {}) }).select("id,status").single();
    if (inserted.error?.code === "23505") return NextResponse.json({ ok: true, alreadyCheckedIn: true, status, message: "오늘 출석이 이미 기록되어 있습니다." });
    if (inserted.error) throw inserted.error;
    return NextResponse.json({ ok: true, status, message: fixedDemoQr ? "출석이 완료되었습니다." : "출석 요청이 접수되었습니다. 선생님 확인 후 출석으로 확정됩니다." }, { status: 201 });
  } catch (cause) {
    console.error("[attendance POST]", cause);
    return error("출석 요청을 처리하지 못했습니다.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = getSession(request);
    if (!session || session.role !== "teacher") return error("선생님 로그인이 필요합니다.", 401);
    const body = await request.json();
    const studentName = String(body.studentName || "").trim();
    const teacherName = String(body.teacherName || "").trim();
    const className = String(body.className || "").trim();
    const date = String(body.date || "");
    const status = String(body.status || "");
    if (!studentName || !teacherName || !className || !DAY_RE.test(date) || !["present", "late", "absent", "pending"].includes(status)) return error("학생·반·날짜·상태를 확인해주세요.", 400);
    if (session.name !== ADMIN && teacherName !== session.name) return error("담당 반만 관리할 수 있습니다.", 403);
    const db = getServerSupabase();
    const roster = await db.from("student_roster").select("id,enrollment_status").eq("student_name", studentName).eq("teacher_name", teacherName).eq("class_name", className).limit(100);
    if (roster.error) throw roster.error;
    if (!roster.data?.some((row) => row.enrollment_status !== "퇴원")) return error("해당 반의 재원 학생이 아닙니다.", 404);
    const existing = await db.from("attendance_records").select("id").eq("student_name", studentName).eq("teacher_name", teacherName).eq("class_name", className).eq("attendance_date", date).maybeSingle();
    if (existing.error) throw existing.error;
    const review = { status, reviewed_by: session.name, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const saved = existing.data
      ? await db.from("attendance_records").update(review).eq("id", existing.data.id).select("id,status").single()
      : await db.from("attendance_records").insert({ student_name: studentName, teacher_name: teacherName, class_name: className, attendance_date: date, ...review }).select("id,status").single();
    if (saved.error) throw saved.error;
    return NextResponse.json({ ok: true, record: saved.data });
  } catch (cause) {
    console.error("[attendance PATCH]", cause);
    return error("출석 상태를 저장하지 못했습니다.", 500);
  }
}

