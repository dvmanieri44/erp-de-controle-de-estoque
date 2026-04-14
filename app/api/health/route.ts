import { NextResponse } from "next/server";

import { getAuditLogProvider } from "@/lib/server/audit-log";
import { getAuthCredentialsProvider } from "@/lib/server/auth-credentials";
import { isFirebaseConfigured } from "@/lib/server/firebase-admin";
import { getErpPersistenceProvider } from "@/lib/server/erp-state";
import { getPasswordResetProvider } from "@/lib/server/password-reset";
import { getRateLimitProvider } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      firebaseConfigured: isFirebaseConfigured(),
      erpPersistence: getErpPersistenceProvider(),
      authCredentials: getAuthCredentialsProvider(),
      rateLimit: getRateLimitProvider(),
      auditLog: getAuditLogProvider(),
      passwordReset: getPasswordResetProvider(),
    },
  });
}
