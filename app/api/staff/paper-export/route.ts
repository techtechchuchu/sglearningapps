import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { staffSession } from "../../../../lib/staff-access";
import { fetchPagedRows } from "../../../../lib/paged-rows";
import { parseProblemNumbers, splitRosterBooks } from "../../../../lib/wrong-answers";

const SUBJECTS: Record<string, string> = { "미적분1 고쟁이": "미적분1", "확통 고쟁이": "확통", "미적분2 쎈": "미적분2", "기하 쎈": "기하", "공통수학2 고쟁이": "공통수학2", "공통수학2 RPM": "공통수학2", "마플교과서 공통수학1": "공통수학1", "공통수학1 RPM": "공통수학1" };

function paperTitle(teacher: string, className: string, grade: string, book: string, month: number, week: number) {
  const course = grade && SUBJECTS[book] ? `${grade} ${SUBJECTS[book]}` : className;
  return `${teacher.replace(/\./g, "")} ${course} 오답 Paper - ${month}월 ${week}주차`;
}

export async function POST(request: NextRequest) {
  try {
    const sessionTeacher = staffSession(request);
    if (!sessionTeacher) return NextResponse.json({ message: "선생님 로그인이 필요합니다." }, { status: 401 });
    const input = await request.json();
    const teacher = sessionTeacher === "전체 관리자" ? String(input.teacher || "").trim() : sessionTeacher;
    const className = String(input.className || "").trim();
    const book = String(input.book || "").trim();
    const month = Number(input.month);
    const week = Number(input.week);
    const selected = [...new Set((Array.isArray(input.students) ? input.students : []).map((value: unknown) => String(value).trim()).filter(Boolean))] as string[];
    if (!teacher || !className || !book || month < 1 || month > 12 || week < 1 || week > 5 || !selected.length || selected.length > 100) return NextResponse.json({ message: "선생님·반·교재·학생·월·주차를 확인해주세요." }, { status: 400 });

    const db = getServerSupabase();
    const roster = await fetchPagedRows((start, end) => db.from("student_roster").select("id,student_name,school_name,grade,book_name,class_name,teacher_name").eq("teacher_name", teacher).eq("class_name", className).in("student_name", selected).range(start, end));
    const eligible = new Map<string, (typeof roster)[number]>();
    for (const row of roster) if (splitRosterBooks(row.book_name).includes(book)) eligible.set(row.student_name, row);
    if (eligible.size !== selected.length) return NextResponse.json({ message: "선택한 학생 중 해당 반·교재에 등록되지 않은 학생이 있습니다." }, { status: 403 });

    const answers = await fetchPagedRows((start, end) => db.from("wrong_answers").select("username,unit,problem,memo").in("username", selected).eq("unit", book).range(start, end));
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("오답 Paper");
    sheet.columns = ["학생명", "학교명", "학년", "담당선생님", "반명", "교재", "문제번호", "비고", "PDF상단제목", "파일명"].map((header) => ({ header, key: header, width: header === "문제번호" || header === "비고" ? 38 : 20 }));
    sheet.getRow(1).font = { bold: true };
    for (const username of selected) {
      const student = eligible.get(username)!;
      const numbers = new Set<string>();
      const memos = new Set<string>();
      for (const answer of answers.filter((row) => row.username === username)) {
        try { parseProblemNumbers(answer.problem).forEach((number) => numbers.add(number)); } catch { /* old malformed record */ }
        if (String(answer.memo || "").trim()) memos.add(String(answer.memo).trim());
      }
      sheet.addRow({ "학생명": username, "학교명": student.school_name || "", "학년": student.grade || "", "담당선생님": teacher, "반명": className, "교재": book, "문제번호": [...numbers].join(", "), "비고": [...memos].join(" / "), "PDF상단제목": paperTitle(teacher, className, student.grade || "", book, month, week), "파일명": `[오답paper][${student.grade || ""} ${username}][${month}월 ${week}주차].pdf` });
    }
    const buffer = await workbook.xlsx.writeBuffer();

    // The Streamlit download also registers selected students in the print queue.
    for (const username of selected) {
      const existing = await db.from("print_status").select("id").eq("teacher_name", teacher).eq("class_name", className).eq("student_name", username).eq("book_name", book).eq("month", month).eq("week", week).limit(1);
      if (existing.error) throw existing.error;
      if (existing.data?.length) continue;
      const created = await db.from("print_status").insert({ teacher_name: teacher, class_name: className, student_name: username, book_name: book, month, week, is_printed: false, printed_at: null, memo: "", created_at: new Date().toISOString() }).select("id").single();
      if (created.error) throw created.error;
    }

    const filename = encodeURIComponent(`${teacher}_${className}_${month}월_${week}주차_오답노트생성.xlsx`);
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${filename}`, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[paper export] failed", error);
    return NextResponse.json({ message: "오답 Paper 엑셀을 만들지 못했습니다." }, { status: 500 });
  }
}
