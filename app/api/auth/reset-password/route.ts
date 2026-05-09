import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/server/audit-log";
import { PasswordResetError, resetPasswordWithToken } from "@/lib/server/password-reset";
import { getRateLimitStatus, registerRateLimitFailure, type RateLimitPolicy } from "@/lib/server/rate-limit";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type ResetPasswordRequestBody = {
  token?: unknown;
  password?: unknown;
};

function createResetRateLimitPolicy(ip: string | null): RateLimitPolicy {
  return {
    scope: "reset-password:ip",
    key: ip ?? "unknown",
    limit: 6,
    windowMs: 1000 * 60 * 10,
    blockDurationMs: 1000 * 60 * 20,
  };
}

export async function POST(request: Request) {
  const requestMetadata = getRequestMetadata(request);

  try {
    const body = (await request.json()) as ResetPasswordRequestBody;

    if (typeof body.token !== "string" || typeof body.password !== "string") {
      return NextResponse.json({ error: "Informe o token e a nova senha." }, { status: 400 });
    }

    const policy = createResetRateLimitPolicy(requestMetadata.ip);
    const status = await getRateLimitStatus(policy);

    if (!status.allowed) {
      await writeAuditLog({
        category: "security",
        action: "auth.reset-password.rate-limited",
        outcome: "denied",
        actor: {
          accountId: null,
          username: null,
          role: null,
        },
        target: {
          accountId: null,
          resource: "password-reset",
        },
        request: requestMetadata,
        metadata: {
          retryAfterSeconds: status.retryAfterSeconds,
        },
      });
      return NextResponse.json(
        { error: "Muitas tentativas de redefinicao. Aguarde alguns minutos e tente novamente." },
        { status: 429 },
      );
    }

    const payload = await resetPasswordWithToken(body.token, body.password);

    await writeAuditLog({
      category: "auth",
      action: "auth.reset-password.completed",
      outcome: "success",
      actor: {
        accountId: payload.accountId,
        username: null,
        role: null,
      },
      target: {
        accountId: payload.accountId,
        resource: "password-reset",
      },
      request: requestMetadata,
    });

    return NextResponse.json({
      reset: true,
      message: "Senha redefinida com sucesso. Voce ja pode fazer login.",
    });
  } catch (error) {
    const policy = createResetRateLimitPolicy(requestMetadata.ip);

    if (error instanceof PasswordResetError) {
      if (error.status !== 400 || !error.message.includes("sucesso")) {
        await registerRateLimitFailure(policy);
      }

      await writeAuditLog({
        category: "auth",
        action: "auth.reset-password.failed",
        outcome: "failure",
        actor: {
          accountId: null,
          username: null,
          role: null,
        },
        target: {
          accountId: null,
          resource: "password-reset",
        },
        request: requestMetadata,
        metadata: {
          error: error.message,
        },
      });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    await registerRateLimitFailure(policy);

    await writeAuditLog({
      category: "auth",
      action: "auth.reset-password.failed",
      outcome: "failure",
      actor: {
        accountId: null,
        username: null,
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

    return NextResponse.json({ error: "Nao foi possivel redefinir a senha agora." }, { status: 500 });
  }
}
