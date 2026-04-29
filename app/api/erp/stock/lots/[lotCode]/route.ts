import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
} from "@/lib/server/erp-access-control";
import { readServerSession } from "@/lib/server/auth-session";
import { readErpResource } from "@/lib/server/erp-state";
import { detectLotLocationMismatch } from "@/lib/server/inventory-movements";

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

    const lotsResource = await readErpResource("operations.lots");
    const lot = lotsResource.data.find((candidate) => candidate.code === lotCode);

    if (!lot) {
      return NextResponse.json(
        { error: "Lote nao encontrado." },
        { status: 404 },
      );
    }

    const mismatchResult = await detectLotLocationMismatch(lot);

    return NextResponse.json({
      stableLocationId: mismatchResult.derivedLocation.stableLocationId,
      inTransitToLocationId: mismatchResult.derivedLocation.inTransitToLocationId,
      confidence: mismatchResult.derivedLocation.confidence,
      mismatch: mismatchResult.hasMismatch,
    });
  } catch (error) {
    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
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
