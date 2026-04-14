import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/server/audit-log";
import { authenticateServerUser, setServerSessionCookie } from "@/lib/server/auth-session";
import { clearRateLimit, getRateLimitStatus, registerRateLimitFailure, type RateLimitPolicy } from "@/lib/server/rate-limit";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type LoginRequestBody = {
  username?: unknown;
  password?: unknown;
};

function createLoginRateLimitPolicies(identifier: string, ip: string | null): RateLimitPolicy[] {
  return [
    {
      scope: "auth-login:identifier",
      key: identifier.trim().toLowerCase(),
      limit: 5,
      windowMs: 1000 * 60 * 10,
      blockDurationMs: 1000 * 60 * 20,
    },
    {
      scope: "auth-login:ip",
      key: ip ?? "unknown",
      limit: 12,
      windowMs: 1000 * 60 * 10,
      blockDurationMs: 1000 * 60 * 20,
    },
  ];
}

export async function POST(request: Request) {
  const requestMetadata = getRequestMetadata(request);

  try {
    const body = (await request.json()) as LoginRequestBody;

    if (typeof body.username !== "string" || typeof body.password !== "string") {
      return NextResponse.json({ error: "Informe usuario e senha." }, { status: 400 });
    }

    const policies = createLoginRateLimitPolicies(body.username, requestMetadata.ip);
    const statuses = await Promise.all(policies.map((policy) => getRateLimitStatus(policy)));
    const blockedStatus = statuses.find((status) => !status.allowed) ?? null;

    if (blockedStatus) {
      await writeAuditLog({
        category: "security",
        action: "auth.login.rate-limited",
        outcome: "denied",
        actor: {
          accountId: null,
          username: body.username.trim().toLowerCase(),
          role: null,
        },
        target: {
          accountId: null,
          resource: "session",
        },
        request: requestMetadata,
        metadata: {
          retryAfterSeconds: blockedStatus.retryAfterSeconds,
        },
      });

      return NextResponse.json(
        { error: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente." },
        { status: 429 },
      );
    }

    const session = await authenticateServerUser(body.username, body.password);

    if (!session) {
      await Promise.all(policies.map((policy) => registerRateLimitFailure(policy)));
      await writeAuditLog({
        category: "auth",
        action: "auth.login.failed",
        outcome: "failure",
        actor: {
          accountId: null,
          username: body.username.trim().toLowerCase(),
          role: null,
        },
        target: {
          accountId: null,
          resource: "session",
        },
        request: requestMetadata,
      });
      return NextResponse.json(
        { error: "Credenciais invalidas. Confira seu usuario ou e-mail e a senha." },
        { status: 401 },
      );
    }

    await Promise.all(policies.map((policy) => clearRateLimit(policy)));

    const response = NextResponse.json({
      authenticated: true,
      account: session.account,
    });

    setServerSessionCookie(response, session);
    await writeAuditLog({
      category: "auth",
      action: "auth.login.succeeded",
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
    return response;
  } catch (error) {
    await writeAuditLog({
      category: "auth",
      action: "auth.login.failed",
      outcome: "failure",
      actor: {
        accountId: null,
        username: null,
        role: null,
      },
      target: {
        accountId: null,
        resource: "session",
      },
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });
    return NextResponse.json({ error: "Falha ao processar o login." }, { status: 500 });
  }
}
