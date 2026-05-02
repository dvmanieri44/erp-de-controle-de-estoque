import { NextResponse } from "next/server";

import { assertCanReadErpResource } from "@/lib/server/erp-access-control";
import {
  getErpApiErrorResponse,
  getUnauthorizedErpResponse,
} from "@/lib/server/erp-api-errors";
import { readServerSession } from "@/lib/server/auth-session";
import { getErpNormalizationDiagnostics } from "@/lib/server/erp-normalization-diagnostics";

export const runtime = "nodejs";

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanReadErpResource(session, "operations.products");
    assertCanReadErpResource(session, "operations.lots");
    assertCanReadErpResource(session, "inventory.locations");
    assertCanReadErpResource(session, "inventory.movements");

    const report = await getErpNormalizationDiagnostics();

    return NextResponse.json(report);
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao gerar diagnostico de normalizacao.",
    });
  }
}
