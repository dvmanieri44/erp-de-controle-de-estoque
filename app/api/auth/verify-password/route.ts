import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/server/audit-log";
import { readServerSession, verifyServerSessionPassword } from "@/lib/server/auth-session";
import { clearRateLimit, getRateLimitStatus, registerRateLimitFailure } from "@/lib/server/rate-limit";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type VerifyPasswordRequestBody = {
  password?: unknown;
};

export async function POST(request: Request) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return NextResponse.json({ error: "Sessao expirada. Entre novamente." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as VerifyPasswordRequestBody;

    if (typeof body.password !== "string" || body.password.trim().length === 0) {
      return NextResponse.json({ error: "Informe sua senha atual." }, { status: 400 });
    }

    const policy = {
      scope: "auth-verify-password",
      key: `${session.account.id}:${requestMetadata.ip ?? "unknown"}`,
      limit: 5,
      windowMs: 1000 * 60 * 10,
      blockDurationMs: 1000 * 60 * 15,
    };
    const status = await getRateLimitStatus(policy);

    if (!status.allowed) {
      await writeAuditLog({
        category: "security",
        action: "auth.verify-password.rate-limited",
        outcome: "denied",
        actor: {
          accountId: session.account.id,
          username: session.username,
          role: session.role,
        },
        target: {
          accountId: session.account.id,
          resource: "account-verification",
        },
        request: requestMetadata,
        metadata: {
          retryAfterSeconds: status.retryAfterSeconds,
        },
      });
      return NextResponse.json(
        { error: "Muitas tentativas de validacao. Aguarde alguns minutos." },
        { status: 429 },
      );
    }

    const valid = await verifyServerSessionPassword(body.password);
    
    if (!valid) {
      await registerRateLimitFailure(policy);
      await writeAuditLog({
        category: "security",
        action: "auth.verify-password.failed",
        outcome: "failure",
        actor: {
          accountId: session.account.id,
          username: session.username,
          role: session.role,
        },
        target: {
          accountId: session.account.id,
          resource: "account-verification",
        },
        request: requestMetadata,
      });
      return NextResponse.json({ valid: false });
    }

    await clearRateLimit(policy);
    await writeAuditLog({
      category: "security",
      action: "auth.verify-password.succeeded",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: session.account.id,
        resource: "account-verification",
      },
      request: requestMetadata,
    });
    return NextResponse.json({ valid });
  } catch (error) {
    await writeAuditLog({
      category: "security",
      action: "auth.verify-password.failed",
      outcome: "failure",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: session.account.id,
        resource: "account-verification",
      },
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });
    return NextResponse.json({ error: "Falha ao validar a senha atual." }, { status: 500 });
  }
}
