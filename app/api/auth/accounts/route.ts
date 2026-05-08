import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/server/audit-log";
import {
  AccountManagementError,
  createManagedAccount,
  listVisibleAccounts,
  parseAccountMutationInput,
} from "@/lib/server/account-management";
import { readServerSession } from "@/lib/server/auth-session";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type CreateAccountRequestBody = {
  currentPassword?: unknown;
  password?: unknown;
  account?: unknown;
};

function getUnauthorizedResponse() {
  return NextResponse.json({ error: "Sessao expirada. Entre novamente." }, { status: 401 });
}

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedResponse();
  }

  try {
    const payload = await listVisibleAccounts(session);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao carregar as contas.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedResponse();
  }

  try {
    const body = (await request.json()) as CreateAccountRequestBody;
    const account = parseAccountMutationInput(body.account);

    if (!account) {
      return NextResponse.json({ error: "Dados invalidos para a nova conta." }, { status: 400 });
    }

    if (typeof body.currentPassword !== "string" || typeof body.password !== "string") {
      return NextResponse.json({ error: "Informe sua senha atual e a nova senha da conta." }, { status: 400 });
    }

    const payload = await createManagedAccount({
      session,
      currentPassword: body.currentPassword,
      account,
      password: body.password,
    });

    await writeAuditLog({
      category: "accounts",
      action: "accounts.create",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: payload.account?.id ?? null,
        resource: "user.accounts",
      },
      request: requestMetadata,
      metadata: {
        targetUsername: payload.account?.username ?? null,
        targetRole: payload.account?.role ?? null,
      },
    });

    return NextResponse.json(payload);
  } catch (error) {
    await writeAuditLog({
      category: "accounts",
      action: "accounts.create",
      outcome: error instanceof AccountManagementError ? "denied" : "failure",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: null,
        resource: "user.accounts",
      },
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    if (error instanceof AccountManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: "Falha ao criar a conta.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}
