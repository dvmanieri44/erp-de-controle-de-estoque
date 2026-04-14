import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/server/audit-log";
import { requestPasswordReset } from "@/lib/server/password-reset";
import { getRateLimitStatus, registerRateLimitFailure, type RateLimitPolicy } from "@/lib/server/rate-limit";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type ForgotPasswordRequestBody = {
  identifier?: unknown;
};

function createRateLimitPolicies(identifier: string, ip: string | null): RateLimitPolicy[] {
  return [
    {
      scope: "forgot-password:identifier",
      key: identifier.trim().toLowerCase(),
      limit: 5,
      windowMs: 1000 * 60 * 10,
      blockDurationMs: 1000 * 60 * 15,
    },
    {
      scope: "forgot-password:ip",
      key: ip ?? "unknown",
      limit: 8,
      windowMs: 1000 * 60 * 10,
      blockDurationMs: 1000 * 60 * 15,
    },
  ];
}

export async function POST(request: Request) {
  const requestMetadata = getRequestMetadata(request);
  const body = (await request.json().catch(() => null)) as ForgotPasswordRequestBody | null;

  try {
    if (typeof body?.identifier !== "string" || body.identifier.trim().length === 0) {
      return NextResponse.json({ error: "Informe seu usuario ou e-mail." }, { status: 400 });
    }

    const policies = createRateLimitPolicies(body.identifier, requestMetadata.ip);
    const statuses = await Promise.all(policies.map((policy) => getRateLimitStatus(policy)));
    const blockedStatus = statuses.find((status) => !status.allowed) ?? null;

    if (blockedStatus) {
      await writeAuditLog({
        category: "security",
        action: "auth.forgot-password.rate-limited",
        outcome: "denied",
        actor: {
          accountId: null,
          username: body.identifier.trim().toLowerCase(),
          role: null,
        },
        target: {
          accountId: null,
          resource: "password-reset",
        },
        request: requestMetadata,
        metadata: {
          retryAfterSeconds: blockedStatus.retryAfterSeconds,
        },
      });
      return NextResponse.json(
        { error: "Muitas tentativas seguidas. Aguarde alguns minutos para tentar novamente." },
        { status: 429 },
      );
    }

    const payload = await requestPasswordReset(body.identifier, requestMetadata);

    await writeAuditLog({
      category: "auth",
      action: "auth.forgot-password.requested",
      outcome: "success",
      actor: {
        accountId: payload.accountId,
        username: body.identifier.trim().toLowerCase(),
        role: null,
      },
      target: {
        accountId: payload.accountId,
        resource: "password-reset",
      },
      request: requestMetadata,
    });

    return NextResponse.json({
      requested: true,
      message: "Se a conta existir, um link de redefinicao foi preparado com seguranca.",
      debugResetUrl: payload.debugResetUrl,
    });
  } catch (error) {
    if (typeof body?.identifier === "string") {
      const policies = createRateLimitPolicies(body.identifier, requestMetadata.ip);
      await Promise.all(policies.map((policy) => registerRateLimitFailure(policy)));
    }

    await writeAuditLog({
      category: "auth",
      action: "auth.forgot-password.failed",
      outcome: "failure",
      actor: {
        accountId: null,
        username: typeof body?.identifier === "string" ? body.identifier.trim().toLowerCase() : null,
        role: null,
      },
      target: {
        accountId: null,
        resource: "password-reset",
      },
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    return NextResponse.json({ error: "Nao foi possivel solicitar a redefinicao agora." }, { status: 500 });
  }
}
