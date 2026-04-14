import { NextResponse } from "next/server";

import { readServerSession } from "@/lib/server/auth-session";

export const runtime = "nodejs";

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    account: session.account,
    username: session.username,
    role: session.role,
    expiresAt: session.expiresAt,
  });
}
