type RosterAssignment = {
  teacher_name?: unknown;
  class_name?: unknown;
  enrollment_status?: unknown;
};

// The roster stores teacher names with several suffixes (for example, 이주백.T).
export function hasLeeJubaekClass(roster: RosterAssignment[]): boolean {
  return roster.some((row) =>
    String(row.teacher_name || "").replace(/[^가-힣]/g, "") === "이주백" &&
    String(row.class_name || "").trim().length > 0 &&
    String(row.enrollment_status || "").trim() === "재원"
  );
}

export function canViewProblemExplanations(studentName: string, roster: RosterAssignment[]): boolean {
  return studentName.trim() === "추재현" || hasLeeJubaekClass(roster);
}

