import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
} from "@/lib/server/erp-access-control";
import { readServerSession } from "@/lib/server/auth-session";
import { listLotLocationMismatchPayloads } from "@/lib/server/stock-lots";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  return NextResponse.json(
    { error: "Sessao obrigatoria para acessar o ERP." },
    { status: 401 },
  );
}

export async function POST(request: Request) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedResponse();
  }

  try {
    assertCanReadErpResource(session, "inventory.movements");
    assertCanReadErpResource(session, "operations.lots");

    const body = (await request.json().catch(() => null)) as
      | { lotCodes?: unknown }
      | null;

    if (!body || !Array.isArray(body.lotCodes)) {
      return NextResponse.json(
        { error: "Informe uma lista de lotes para consulta." },
        { status: 400 },
      );
    }

    if (!body.lotCodes.every((lotCode) => typeof lotCode === "string")) {
      return NextResponse.json(
        { error: "A lista de lotes deve conter apenas textos." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      await listLotLocationMismatchPayloads(body.lotCodes),
    );
  } catch (error) {
    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: "Falha ao carregar as localizacoes derivadas dos lotes.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}
