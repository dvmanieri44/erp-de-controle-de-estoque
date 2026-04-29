import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
} from "@/lib/server/erp-access-control";
import { readServerSession } from "@/lib/server/auth-session";
import {
  getInventoryMovementsPersistenceProvider,
  listLocationStockBalances,
} from "@/lib/server/inventory-movements";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  return NextResponse.json(
    { error: "Sessao obrigatoria para acessar o ERP." },
    { status: 401 },
  );
}

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedResponse();
  }

  try {
    assertCanReadErpResource(session, "inventory.movements");
    assertCanReadErpResource(session, "inventory.locations");

    const payload = await listLocationStockBalances();

    return NextResponse.json({
      ...payload,
      provider: getInventoryMovementsPersistenceProvider(),
    });
  } catch (error) {
    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: "Falha ao carregar o saldo por localizacao.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}
