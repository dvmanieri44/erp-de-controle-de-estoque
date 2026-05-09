import { NextResponse } from "next/server";

import { isFirebaseConfigured } from "@/lib/server/firebase-admin";
import { describeServerPersistence } from "@/lib/server/server-persistence";

export const runtime = "nodejs";

export async function GET() {
  const erpPersistence = describeServerPersistence("erp");
  const authCredentials = describeServerPersistence("credenciais de autenticacao");
  const rateLimit = describeServerPersistence("rate limit");
  const auditLog = describeServerPersistence("auditoria");
  const passwordReset = describeServerPersistence("tokens de redefinicao de senha");

  return NextResponse.json({
    status:
      erpPersistence.misconfigured ||
      authCredentials.misconfigured ||
      rateLimit.misconfigured ||
      auditLog.misconfigured ||
      passwordReset.misconfigured
        ? "degraded"
        : "ok",
    timestamp: new Date().toISOString(),
    services: {
      firebaseConfigured: isFirebaseConfigured(),
      erpPersistence: erpPersistence.provider,
      authCredentials: authCredentials.provider,
      rateLimit: rateLimit.provider,
      auditLog: auditLog.provider,
      passwordReset: passwordReset.provider,
      localFallbackAllowed:
        erpPersistence.localFallbackAllowed &&
        authCredentials.localFallbackAllowed &&
        rateLimit.localFallbackAllowed &&
        auditLog.localFallbackAllowed &&
        passwordReset.localFallbackAllowed,
      misconfiguration: [
        erpPersistence,
        authCredentials,
        rateLimit,
        auditLog,
        passwordReset,
      ]
        .filter((service) => service.misconfigured)
        .map((service) => service.error),
    },
  });
}
