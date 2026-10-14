import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../lib/session";

export async function GET(request: NextRequest) {
  try {
    const session = getSession(request);
    return NextResponse.json(session ? { authenticated: true, role: session.role, name: session.name } : { authenticated: false });
  } catch (error) {
    console.error("[session restore] failed", error);
    return NextResponse.json({ authenticated: false });
  }
}
