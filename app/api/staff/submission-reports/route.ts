import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { staffSession } from "../../../../lib/staff-access";
import { parseSubmissionReportText } from "../../../../lib/submission-report";

export async function POST(request: NextRequest) {
  try {
    if (staffSession(request) !== "전체 관리자") {
      return NextResponse.json({ message: "전체 관리자만 보고서를 등록할 수 있습니다." }, { status: 403 });
    }
    const body = await request.json();
    const filename = String(body.filename || "").trim();
    const text = String(body.text || "");
    if (!filename.toLowerCase().endsWith(".pdf") || !text.trim() || text.length > 1_000_000) {
      return NextResponse.json({ message: "올바른 PDF 텍스트를 보내주세요." }, { status: 400 });
    }
    const report = parseSubmissionReportText(text, filename);
    if (!report.ok || !report.cutoffAt || !report.teacher) {
      return NextResponse.json({ message: report.error || "담당 선생님과 기준 시각을 확인할 수 없습니다." }, { status: 400 });
    }
    const db = getServerSupabase();
    const teacherCheck = await db.from("student_roster").select("id").eq("teacher_name", report.teacher).limit(1);
    if (teacherCheck.error) throw teacherCheck.error;
    if (!teacherCheck.data?.length) return NextResponse.json({ message: "명단에 없는 담당 선생님입니다." }, { status: 400 });

    const existing = await db.from("submission_report_history").select("id")
      .eq("teacher_name", report.teacher).eq("cutoff_at", report.cutoffAt).limit(1);
    if (existing.error) throw existing.error;
    const payload = {
      teacher_name: report.teacher,
      report_filename: filename,
      period_start: report.startAt,
      cutoff_at: report.cutoffAt,
      target_count: report.targetCount,
      note_count: report.noteCount,
      uploaded_at: new Date().toISOString(),
      uploaded_by: "전체 관리자",
    };
    const saved = existing.data?.length
      ? await db.from("submission_report_history").update(payload).eq("id", existing.data[0].id).select("id,teacher_name,cutoff_at").single()
      : await db.from("submission_report_history").insert(payload).select("id,teacher_name,cutoff_at").single();
    if (saved.error) throw saved.error;
    const verified = await db.from("submission_report_history").select("id,teacher_name,cutoff_at")
      .eq("id", saved.data.id).single();
    if (verified.error || !verified.data || verified.data.teacher_name !== report.teacher || !String(verified.data.cutoff_at || "").startsWith(report.cutoffAt)) {
      throw verified.error || new Error("Report readback mismatch");
    }
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    console.error("[submission report] save failed", error);
    return NextResponse.json({ message: "보고서를 저장하거나 저장 결과를 검증하지 못했습니다." }, { status: 500 });
  }
}
