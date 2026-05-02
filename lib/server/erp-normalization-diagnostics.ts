import "server-only";

import { listInventoryMovements } from "@/lib/server/inventory-movements";
import { listLocations } from "@/lib/server/inventory-locations";
import { listLots } from "@/lib/server/inventory-lots";
import { listProducts } from "@/lib/server/operations-products";

const MAX_EXAMPLES = 10;

type DiagnosticExample = {
  id: string;
  label?: string;
  field: string;
  value: string | null;
  reason: string;
};

type DiagnosticCheck = {
  count: number;
  examples: DiagnosticExample[];
};

type DiagnosticChecks = {
  productsWithoutValidSku: DiagnosticCheck;
  lotsWithoutProductId: DiagnosticCheck;
  lotsWithoutLocationId: DiagnosticCheck;
  movementsWithoutProductId: DiagnosticCheck;
  movementsWithoutLotCode: DiagnosticCheck;
  brokenReferences: DiagnosticCheck;
};

type NormalizationDiagnosticsReport = {
  generatedAt: string;
  dryRun: true;
  checked: {
    products: number;
    lots: number;
    locations: number;
    movements: number;
  };
  summary: {
    totalIssues: number;
    checksWithIssues: number;
  };
  checks: DiagnosticChecks;
};

function normalizeIdentifier(value: string) {
  return value.trim().toUpperCase();
}

function normalizeTextIdentifier(value: string) {
  return value.trim();
}

function hasValue(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidSku(value: unknown) {
  if (!hasValue(value)) {
    return false;
  }

  const normalized = normalizeIdentifier(value);
  return value === normalized && /^[A-Z0-9._-]+$/.test(normalized);
}

function createCheck(): DiagnosticCheck {
  return {
    count: 0,
    examples: [],
  };
}

function addIssue(check: DiagnosticCheck, example: DiagnosticExample) {
  check.count += 1;

  if (check.examples.length < MAX_EXAMPLES) {
    check.examples.push(example);
  }
}

export async function getErpNormalizationDiagnostics(): Promise<NormalizationDiagnosticsReport> {
  const [productsPayload, lotsPayload, locationsPayload, movementsPayload] =
    await Promise.all([
      listProducts(),
      listLots(),
      listLocations(),
      listInventoryMovements(),
    ]);

  const products = productsPayload.items;
  const lots = lotsPayload.items;
  const locations = locationsPayload.items;
  const movements = movementsPayload.items;
  const productSkuSet = new Set(products.map((product) => normalizeIdentifier(product.sku)));
  const lotCodeSet = new Set(lots.map((lot) => normalizeTextIdentifier(lot.code)));
  const locationIdSet = new Set(locations.map((location) => normalizeTextIdentifier(location.id)));

  const checks: DiagnosticChecks = {
    productsWithoutValidSku: createCheck(),
    lotsWithoutProductId: createCheck(),
    lotsWithoutLocationId: createCheck(),
    movementsWithoutProductId: createCheck(),
    movementsWithoutLotCode: createCheck(),
    brokenReferences: createCheck(),
  };

  for (const product of products) {
    if (!isValidSku(product.sku)) {
      addIssue(checks.productsWithoutValidSku, {
        id: product.sku || product.product,
        label: product.product,
        field: "sku",
        value: product.sku || null,
        reason: "Produto sem SKU normalizado e nao vazio.",
      });
    }
  }

  for (const lot of lots) {
    if (!hasValue(lot.productId)) {
      addIssue(checks.lotsWithoutProductId, {
        id: lot.code,
        label: lot.product,
        field: "productId",
        value: lot.productId ?? null,
        reason: "Lote ainda depende do fallback por nome do produto.",
      });
    } else if (!productSkuSet.has(normalizeIdentifier(lot.productId))) {
      addIssue(checks.brokenReferences, {
        id: lot.code,
        label: lot.product,
        field: "lot.productId",
        value: lot.productId,
        reason: "productId do lote nao existe no catalogo de produtos.",
      });
    }

    if (!hasValue(lot.locationId)) {
      addIssue(checks.lotsWithoutLocationId, {
        id: lot.code,
        label: lot.location,
        field: "locationId",
        value: lot.locationId ?? null,
        reason: "Lote ainda depende do fallback por nome da localizacao.",
      });
    } else if (!locationIdSet.has(normalizeTextIdentifier(lot.locationId))) {
      addIssue(checks.brokenReferences, {
        id: lot.code,
        label: lot.location,
        field: "lot.locationId",
        value: lot.locationId,
        reason: "locationId do lote nao existe no cadastro de localizacoes.",
      });
    }
  }

  for (const movement of movements) {
    if (!hasValue(movement.productId)) {
      addIssue(checks.movementsWithoutProductId, {
        id: movement.id,
        label: movement.product,
        field: "productId",
        value: movement.productId ?? null,
        reason: "Movimentacao ainda depende do fallback por nome do produto.",
      });
    } else if (!productSkuSet.has(normalizeIdentifier(movement.productId))) {
      addIssue(checks.brokenReferences, {
        id: movement.id,
        label: movement.product,
        field: "movement.productId",
        value: movement.productId,
        reason: "productId da movimentacao nao existe no catalogo de produtos.",
      });
    }

    if (!hasValue(movement.lotCode)) {
      addIssue(checks.movementsWithoutLotCode, {
        id: movement.id,
        label: movement.product,
        field: "lotCode",
        value: movement.lotCode ?? null,
        reason: "Movimentacao ainda nao esta vinculada a lote.",
      });
    } else if (!lotCodeSet.has(normalizeTextIdentifier(movement.lotCode))) {
      addIssue(checks.brokenReferences, {
        id: movement.id,
        label: movement.product,
        field: "movement.lotCode",
        value: movement.lotCode,
        reason: "lotCode da movimentacao nao existe no cadastro de lotes.",
      });
    }

    for (const field of ["locationId", "fromLocationId", "toLocationId"] as const) {
      const value = movement[field];

      if (hasValue(value) && !locationIdSet.has(normalizeTextIdentifier(value))) {
        addIssue(checks.brokenReferences, {
          id: movement.id,
          label: movement.product,
          field: `movement.${field}`,
          value,
          reason: `${field} da movimentacao nao existe no cadastro de localizacoes.`,
        });
      }
    }
  }

  const checkValues = Object.values(checks);
  const totalIssues = checkValues.reduce((total, check) => total + check.count, 0);
  const checksWithIssues = checkValues.filter((check) => check.count > 0).length;

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    checked: {
      products: products.length,
      lots: lots.length,
      locations: locations.length,
      movements: movements.length,
    },
    summary: {
      totalIssues,
      checksWithIssues,
    },
    checks,
  };
}
