import type { NextRequest } from "next/server";
import { getSession, type Session } from "./session";
import { getServerSupabase } from "./supabase-server";

// A signed cookie can outlive a withdrawal. Check account state on every protected request.
export async function getActiveSession(request: NextRequest): Promise<Session | null> {
  const session = getSession(request);
  if (!session || session.role === "teacher") return session;
  const db = getServerSupabase();
  const result = session.role === "student"
    ? await db.from("users").select("withdrawn_at,signup_status").eq("username", session.name).maybeSingle()
    : await db.from("university_users").select("withdrawn_at").eq(session.role === "member" ? "id" : "email", session.name).maybeSingle();
  if (result.error) throw result.error;
  return result.data && !result.data.withdrawn_at && (session.role !== "student" || ("signup_status" in result.data && result.data.signup_status === "approved")) ? session : null;
}
