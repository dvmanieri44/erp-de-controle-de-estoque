import { NextResponse } from "next/server";

import {
  assertCanBackfillErpResource,
  ErpAccessDeniedError,
  assertCanReadErpResource,
} from "@/lib/server/erp-access-control";
import {
  getAuditErrorMetadata,
  writeErpMutationAuditLog,
} from "@/lib/server/erp-audit";
import {
  getErpApiErrorResponse,
  getUnauthorizedErpResponse,
  readJsonObjectBody,
} from "@/lib/server/erp-api-errors";
import { readServerSession } from "@/lib/server/auth-session";
import {
  applyLotBackfill,
  getLotBackfillDryRun,
} from "@/lib/server/erp-lot-backfill-diagnostics";
import { listLots } from "@/lib/server/inventory-lots";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

const LOTS_RESOURCE_ID = "operations.lots";

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanReadErpResource(session, "operations.products");
    assertCanReadErpResource(session, LOTS_RESOURCE_ID);
    assertCanReadErpResource(session, "inventory.locations");

    const report = await getLotBackfillDryRun();

    return NextResponse.json(report);
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao gerar dry-run de backfill de lotes.",
    });
  }
}

export async function POST(request: Request) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  let shouldApply = false;

  try {
    const body = await readJsonObjectBody(request);
    shouldApply = body.apply === true;

    assertCanReadErpResource(session, "operations.products");
    assertCanReadErpResource(session, LOTS_RESOURCE_ID);
    assertCanReadErpResource(session, "inventory.locations");

    if (shouldApply) {
      assertCanBackfillErpResource(session, LOTS_RESOURCE_ID);
    }

    const beforeLots = shouldApply ? await listLots() : null;
    const report = await applyLotBackfill({ apply: shouldApply });

    if (shouldApply) {
      const afterLots = await listLots();
      const appliedLotCodes = new Set(report.applied.map((entry) => entry.lotCode));
      const before = beforeLots?.items.filter((lot) => appliedLotCodes.has(lot.code)) ?? [];
      const after = afterLots.items.filter((lot) => appliedLotCodes.has(lot.code));

      await writeErpMutationAuditLog({
        action: "erp.lots.backfill.applied",
        outcome: report.failed.length > 0 ? "failure" : "success",
        session,
        resource: LOTS_RESOURCE_ID,
        request: requestMetadata,
        before,
        after,
        metadata: {
          applied: report.applied.length,
          ignored: report.ignored.length,
          failed: report.failed.length,
        },
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    if (shouldApply) {
      await writeErpMutationAuditLog({
        action: "erp.lots.backfill.applied",
        outcome,
        session,
        resource: LOTS_RESOURCE_ID,
        request: requestMetadata,
        metadata: getAuditErrorMetadata(error),
      });
    }

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para backfill de lotes.",
      fallbackErrorMessage: "Falha ao executar backfill de lotes.",
    });
  }
}
