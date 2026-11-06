type RosterRow = {
  student_name?: unknown;
  grade?: unknown;
  class_name?: unknown;
  enrollment_status?: unknown;
};

export function matchesStudentSignupRoster(row: RosterRow, studentName: string, signupGrade: string): boolean {
  if (String(row.student_name || "").trim() !== studentName.trim() || row.enrollment_status !== "재원") return false;
  const rosterGrade = String(row.grade || "").replace(/\s/g, "");
  const requestedGrade = signupGrade.replace(/\s/g, "");
  if (!rosterGrade || rosterGrade === requestedGrade) return true;
  // Imported high-school rosters use 1/2/3, while signup stores 고1/고2/고3.
  return /^고[1-3]$/.test(requestedGrade)
    && rosterGrade === requestedGrade.slice(1)
    && String(row.class_name || "").replace(/\s/g, "").includes(requestedGrade);
}
