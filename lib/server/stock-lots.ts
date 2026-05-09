import "server-only";

import { getLotByCode } from "@/lib/server/inventory-lots";
import { detectLotLocationMismatch } from "@/lib/server/inventory-movements";

export async function getLotLocationMismatchPayload(lotCode: string) {
  const lot = await getLotByCode(lotCode);
  const mismatchResult = await detectLotLocationMismatch(lot);

  return {
    stableLocationId: mismatchResult.derivedLocation.stableLocationId,
    inTransitToLocationId: mismatchResult.derivedLocation.inTransitToLocationId,
    confidence: mismatchResult.derivedLocation.confidence,
    mismatch: mismatchResult.hasMismatch,
  };
}

export async function listLotLocationMismatchPayloads(lotCodes: readonly string[]) {
  const uniqueLotCodes = [...new Set(
    lotCodes.map((lotCode) => lotCode.trim()).filter(Boolean),
  )];
  const results = await Promise.allSettled(
    uniqueLotCodes.map(async (lotCode) => ({
      lotCode,
      ...(await getLotLocationMismatchPayload(lotCode)),
    })),
  );
  const items: Array<{
    lotCode: string;
    stableLocationId: string | null;
    inTransitToLocationId: string | null;
    confidence: "high" | "medium" | "low";
    mismatch: boolean;
  }> = [];
  const errors: Array<{ lotCode: string; error: string }> = [];

  results.forEach((result, index) => {
    const lotCode = uniqueLotCodes[index] ?? "";

    if (result.status === "fulfilled") {
      items.push(result.value);
      return;
    }

    errors.push({
      lotCode,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : "Falha ao carregar a localizacao derivada do lote.",
    });
  });

  return {
    items,
    errors,
  };
}
