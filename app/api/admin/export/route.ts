import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { staffSession } from "../../../../lib/staff-access";
import { fetchPagedRows } from "../../../../lib/paged-rows";

const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function download(buffer: ExcelJS.Buffer, name: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: NextRequest) {
  if (staffSession(request) !== "전체 관리자") {
    return NextResponse.json({ message: "전체 관리자만 다운로드할 수 있습니다." }, { status: 403 });
  }
  const kind = request.nextUrl.searchParams.get("kind");
  if (kind !== "roster" && kind !== "members") {
    return NextResponse.json({ message: "다운로드 종류를 확인해주세요." }, { status: 400 });
  }
  try {
    const db = getServerSupabase();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "스터디결";
    if (kind === "roster") {
      const rows = await fetchPagedRows((start, end) => db.from("student_roster")
        .select("id,class_name,teacher_name,student_name,school_name,grade,book_name,created_at,enrollment_status,exited_at,status_note")
        .order("teacher_name").order("class_name").order("student_name").range(start, end));
      const sheet = workbook.addWorksheet("학생명단");
      const fields = [
        ["기록ID", "id"], ["반명", "class_name"], ["담당선생님", "teacher_name"],
        ["학생명", "student_name"], ["학교명", "school_name"], ["학년", "grade"],
        ["매칭교재", "book_name"], ["등록일시", "created_at"], ["재원상태", "enrollment_status"],
        ["퇴원일시", "exited_at"], ["상태메모", "status_note"],
      ] as const;
      sheet.columns = fields.map(([header, key]) => ({ header, key, width: key === "book_name" ? 45 : 20 }));
      for (const row of rows) sheet.addRow(Object.fromEntries(fields.map(([, key]) => [key, key === "enrollment_status" ? row[key] || "재원" : row[key] ?? ""])));
      sheet.getRow(1).font = { bold: true };
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      sheet.autoFilter = { from: "A1", to: "K1" };
      return download(await workbook.xlsx.writeBuffer(), "현재_학생명단.xlsx");
    }

    const [users, answers] = await Promise.all([
      fetchPagedRows((start, end) => db.from("users").select("username,grade,created_at").order("created_at", { ascending: false }).range(start, end)),
      fetchPagedRows((start, end) => db.from("wrong_answers").select("username").range(start, end)),
    ]);
    const counts = new Map<string, number>();
    for (const row of answers) if (row.username) counts.set(row.username, (counts.get(row.username) || 0) + 1);
    const sheet = workbook.addWorksheet("회원목록");
    sheet.columns = [
      { header: "학생", key: "name", width: 24 }, { header: "학년", key: "grade", width: 16 },
      { header: "가입일시", key: "created", width: 27 }, { header: "오답개수", key: "count", width: 16 },
    ];
    for (const row of users) sheet.addRow({ name: row.username, grade: row.grade || "미지정", created: row.created_at || "", count: counts.get(row.username) || 0 });
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: "A1", to: "D1" };
    return download(await workbook.xlsx.writeBuffer(), "회원목록.xlsx");
  } catch (error) {
    console.error("[admin export] failed", error);
    return NextResponse.json({ message: "엑셀을 만들지 못했습니다." }, { status: 500 });
  }
}
