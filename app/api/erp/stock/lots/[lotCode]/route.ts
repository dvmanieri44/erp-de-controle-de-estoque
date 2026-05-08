import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
} from "@/lib/server/erp-access-control";
import { readServerSession } from "@/lib/server/auth-session";
import { InventoryLotNotFoundError } from "@/lib/server/inventory-lots";
import { getLotLocationMismatchPayload } from "@/lib/server/stock-lots";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    lotCode: string;
  }>;
};

function getUnauthorizedResponse() {
  return NextResponse.json(
    { error: "Sessao obrigatoria para acessar o ERP." },
    { status: 401 },
  );
}

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedResponse();
  }

  try {
    const { lotCode } = await context.params;

    assertCanReadErpResource(session, "inventory.movements");
    assertCanReadErpResource(session, "operations.lots");

    return NextResponse.json(await getLotLocationMismatchPayload(lotCode));
  } catch (error) {
    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof InventoryLotNotFoundError) {
      return NextResponse.json(
        { error: "Lote nao encontrado." },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: "Falha ao carregar a localizacao derivada do lote.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}
