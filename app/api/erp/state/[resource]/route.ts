import { NextResponse } from "next/server";

import { isErpResourceId } from "@/lib/erp-data-resources";
import { writeAuditLog } from "@/lib/server/audit-log";
import { readServerSession } from "@/lib/server/auth-session";
import { readErpResource, writeErpResource } from "@/lib/server/erp-state";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    resource: string;
  }>;
};

function getUnauthorizedResponse() {
  return NextResponse.json({ error: "Sessao obrigatoria para acessar o ERP." }, { status: 401 });
}

function getRestrictedResourceResponse() {
  return NextResponse.json(
    { error: "Esse recurso sensivel deve ser acessado pelas rotas dedicadas de autenticacao." },
    { status: 403 },
  );
}

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedResponse();
  }

  const { resource } = await context.params;

  if (!isErpResourceId(resource)) {
    return NextResponse.json({ error: "Recurso nao encontrado." }, { status: 404 });
  }

  if (resource === "user.accounts") {
    return getRestrictedResourceResponse();
  }

  try {
    const payload = await readErpResource(resource);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao carregar o recurso do ERP.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedResponse();
  }

  const { resource } = await context.params;

  if (!isErpResourceId(resource)) {
    return NextResponse.json({ error: "Recurso nao encontrado." }, { status: 404 });
  }

  if (resource === "user.accounts") {
    return getRestrictedResourceResponse();
  }

  try {
    const body = (await request.json()) as { data?: unknown };

    if (!Array.isArray(body.data)) {
      return NextResponse.json({ error: "Carga invalida para persistencia." }, { status: 400 });
    }

    const payload = await writeErpResource(resource, body.data);
    await writeAuditLog({
      category: "erp",
      action: "erp.resource.updated",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: null,
        resource,
      },
      request: requestMetadata,
      metadata: {
        items: body.data.length,
      },
    });
    return NextResponse.json(payload);
  } catch (error) {
    await writeAuditLog({
      category: "erp",
      action: "erp.resource.updated",
      outcome: "failure",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: null,
        resource,
      },
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });
    return NextResponse.json(
      {
        error: "Falha ao salvar o recurso do ERP.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}
