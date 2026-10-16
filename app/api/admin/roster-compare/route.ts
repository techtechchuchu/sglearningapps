import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { staffSession } from "../../../../lib/staff-access";

export const runtime = "nodejs";

type ImportedRow = { student: string; teacher: string; className: string; source: string };
const TEACHERS = ["노대근", "박병민", "이주백"];
const MAX_FILE_SIZE = 8 * 1024 * 1024;

function text(value: ExcelJS.CellValue | undefined) {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value) return String(value.text || "").trim();
  return String(value).trim();
}

function parseSheet(workbook: ExcelJS.Workbook, fileName: string): ImportedRow[] {
  const rows: ImportedRow[] = [];
  for (const sheet of workbook.worksheets) {
    let headerRow = 0;
    let nameColumn = 0;
    let classColumn = 0;
    for (let rowIndex = 1; rowIndex <= Math.min(sheet.rowCount, 20); rowIndex += 1) {
      const row = sheet.getRow(rowIndex);
      row.eachCell((cell, column) => {
        const value = text(cell.value).replace(/\s/g, "");
        if (value === "이름" || value === "학생명") nameColumn = column;
        if (value === "반명" || value === "반") classColumn = column;
      });
      if (nameColumn && classColumn) { headerRow = rowIndex; break; }
      nameColumn = 0;
      classColumn = 0;
    }
    if (!headerRow) continue;
    for (let rowIndex = headerRow + 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
      const row = sheet.getRow(rowIndex);
      const student = text(row.getCell(nameColumn).value);
      const rawClass = text(row.getCell(classColumn).value);
      if (!student || !rawClass || student === "이름") continue;
      const teacherMatch = rawClass.match(/(노대근|박병민|이주백)\s*\.?\s*T\s*$/i);
      const fileTeacher = fileName.match(/(노대근|박병민|이주백)/)?.[1] || "";
      const teacher = teacherMatch?.[1] || fileTeacher;
      const className = teacherMatch ? rawClass.slice(0, teacherMatch.index).trim() : rawClass;
      if (!teacher || !className) continue;
      rows.push({ student, teacher: `${teacher}.T`, className, source: fileName });
    }
  }
  return rows;
}

export async function POST(request: NextRequest) {
  if (staffSession(request) !== "전체 관리자") return NextResponse.json({ message: "전체 관리자만 이용할 수 있습니다." }, { status: 403 });
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((item): item is File => item instanceof File);
    if (!files.length || files.length > 10) return NextResponse.json({ message: "중심업무 Excel 파일을 선택해주세요." }, { status: 400 });
    const allRows: ImportedRow[] = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > MAX_FILE_SIZE) return NextResponse.json({ message: `${file.name}: xlsx 파일(파일당 8MB 이하)만 비교할 수 있습니다.` }, { status: 400 });
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      allRows.push(...parseSheet(workbook, file.name));
    }
    if (!allRows.length) return NextResponse.json({ message: "파일에서 이름·반명 열을 찾지 못했습니다. 중심업무 학생전체처리 Excel 파일인지 확인해주세요." }, { status: 422 });
    const unique = new Map<string, ImportedRow>();
    for (const row of allRows) unique.set(`${row.student}\u0000${row.teacher}\u0000${row.className}`, row);
    return NextResponse.json({ rows: [...unique.values()], importedRows: allRows.length, duplicateRows: allRows.length - unique.size, sources: files.map((file) => file.name) });
  } catch (error) {
    console.error("[admin roster compare] failed", error);
    return NextResponse.json({ message: "명단 파일을 읽지 못했습니다." }, { status: 500 });
  }
}

