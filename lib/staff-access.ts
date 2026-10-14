import type { NextRequest } from "next/server";
import { getSession } from "./session";
import { getServerSupabase } from "./supabase-server";

export function staffSession(request: NextRequest) {
  const session = getSession(request);
  return session?.role === "teacher" ? session.name : null;
}

export async function canManageStudent(db: ReturnType<typeof getServerSupabase>, teacher: string, username: string) {
  if (teacher === "전체 관리자") return true;
  const roster = await db.from("student_roster").select("id").eq("student_name", username).eq("teacher_name", teacher).limit(1);
  if (roster.error) throw roster.error;
  return Boolean(roster.data?.length);
}
