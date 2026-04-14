import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/server/audit-log";
import { clearServerSessionCookie, readServerSession } from "@/lib/server/auth-session";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const response = NextResponse.json({ authenticated: false });
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (session) {
    await writeAuditLog({
      category: "auth",
      action: "auth.logout",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: session.account.id,
        resource: "session",
      },
      request: requestMetadata,
    });
  }

  clearServerSessionCookie(response);
  return response;
}
