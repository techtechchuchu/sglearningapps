import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE = "sg_session";
const TTL_SECONDS = 12 * 60 * 60;

type Session = { role: "student" | "teacher"; name: string; expires: number };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function setSession(response: NextResponse, role: Session["role"], name: string) {
  const payload = Buffer.from(JSON.stringify({
    role,
    name,
    expires: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  })).toString("base64url");
  response.cookies.set(SESSION_COOKIE, payload + "." + signature(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export function getSession(request: NextRequest): Session | null {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra) return null;
  const expected = Buffer.from(signature(payload));
  const received = Buffer.from(mac);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const session: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session || typeof session !== "object") return null;
    const s = session as Partial<Session>;
    if (
      (s.role !== "student" && s.role !== "teacher") ||
      typeof s.name !== "string" || !s.name.trim() ||
      typeof s.expires !== "number" || s.expires <= Math.floor(Date.now() / 1000)
    ) return null;
    return s as Session;
  } catch {
    return null;
  }
}
