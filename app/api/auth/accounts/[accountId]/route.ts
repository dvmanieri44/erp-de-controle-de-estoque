import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/server/audit-log";
import {
  AccountManagementError,
  deleteManagedAccount,
  parseAccountMutationInput,
  updateManagedAccount,
} from "@/lib/server/account-management";
import { readServerSession } from "@/lib/server/auth-session";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    accountId: string;
  }>;
};

type UpdateAccountRequestBody = {
  currentPassword?: unknown;
  password?: unknown;
  account?: unknown;
};

type DeleteAccountRequestBody = {
  currentPassword?: unknown;
};

function getUnauthorizedResponse() {
  return NextResponse.json({ error: "Sessao expirada. Entre novamente." }, { status: 401 });
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedResponse();
  }

  try {
    const { accountId } = await context.params;
    const body = (await request.json()) as UpdateAccountRequestBody;
    const account = parseAccountMutationInput(body.account);

    if (!account) {
      return NextResponse.json({ error: "Dados invalidos para atualizar a conta." }, { status: 400 });
    }

    if (typeof body.currentPassword !== "string") {
      return NextResponse.json({ error: "Informe sua senha atual para salvar." }, { status: 400 });
    }

    const payload = await updateManagedAccount({
      session,
      accountId,
      currentPassword: body.currentPassword,
      account,
      password: typeof body.password === "string" ? body.password : undefined,
    });

    await writeAuditLog({
      category: "accounts",
      action: "accounts.update",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId,
        resource: "user.accounts",
      },
      request: requestMetadata,
      metadata: {
        targetUsername: payload.account?.username ?? null,
        targetRole: payload.account?.role ?? null,
        passwordChanged: typeof body.password === "string" && body.password.trim().length > 0,
      },
    });

    return NextResponse.json(payload);
  } catch (error) {
    const { accountId } = await context.params;

    await writeAuditLog({
      category: "accounts",
      action: "accounts.update",
      outcome: error instanceof AccountManagementError ? "denied" : "failure",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId,
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
        error: "Falha ao atualizar a conta.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedResponse();
  }

  try {
    const { accountId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as DeleteAccountRequestBody;

    if (typeof body.currentPassword !== "string") {
      return NextResponse.json({ error: "Informe sua senha atual para excluir." }, { status: 400 });
    }

    const payload = await deleteManagedAccount({
      session,
      accountId,
      currentPassword: body.currentPassword,
    });

    await writeAuditLog({
      category: "accounts",
      action: "accounts.delete",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId,
        resource: "user.accounts",
      },
      request: requestMetadata,
    });

    return NextResponse.json(payload);
  } catch (error) {
    const { accountId } = await context.params;

    await writeAuditLog({
      category: "accounts",
      action: "accounts.delete",
      outcome: error instanceof AccountManagementError ? "denied" : "failure",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId,
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
        error: "Falha ao excluir a conta.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}
