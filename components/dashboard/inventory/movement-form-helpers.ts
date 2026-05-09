import {
  buildLocationStockBalanceMap,
  fetchLocationStockBalances,
  findMatchingProductReference,
  loadMovements,
  normalizeReferenceText,
  refreshLocationStockBalances,
  refreshMovements,
  type LocationStockBalanceMap,
  type MovementItem,
  type VersionedMovementItem,
} from "@/lib/inventory";
import type { LotItem, ProductLineItem } from "@/lib/operations-data";

type ProductLotIdentityMessages = {
  productIdRequired: string;
  lotCodeRequired: string;
  lotProductMismatch: string;
};

type ResolveProductLotIdentityInput = {
  productCatalog: readonly ProductLineItem[];
  lotCatalog: readonly LotItem[];
  product: string;
  productId?: string;
  lotCode?: string;
  currentProduct?: string;
  currentProductId?: string;
  currentLotCode?: string;
  messages: ProductLotIdentityMessages;
};

export type LocationStockBalanceResolution = {
  balances: LocationStockBalanceMap;
  isUsingFallback: boolean;
};

type ValidationLocationStockBalanceResolution = LocationStockBalanceResolution & {
  validationBalances: LocationStockBalanceMap;
};

type MovementsWithStockResolution = {
  movements: VersionedMovementItem[];
  stock: LocationStockBalanceResolution;
};

export function buildProductOptionValue(product: Pick<ProductLineItem, "product" | "sku">) {
  return `${product.product} (${product.sku})`;
}

export function buildLotOptionValue(lot: Pick<LotItem, "code" | "product">) {
  return `${lot.code} (${lot.product})`;
}

export function resolveProductSelection(
  products: readonly ProductLineItem[],
  value: string,
) {
  const normalizedValue = normalizeReferenceText(value);

  if (!normalizedValue) {
    return null;
  }

  return (
    products.find((product) => {
      return (
        normalizeReferenceText(product.sku) === normalizedValue ||
        normalizeReferenceText(product.product) === normalizedValue ||
        normalizeReferenceText(buildProductOptionValue(product)) === normalizedValue
      );
    }) ??
    findMatchingProductReference(products, value) ??
    null
  );
}

export function resolveLotSelection(lots: readonly LotItem[], value: string) {
  const normalizedValue = normalizeReferenceText(value);

  if (!normalizedValue) {
    return null;
  }

  return (
    lots.find((lot) => {
      return (
        normalizeReferenceText(lot.code) === normalizedValue ||
        normalizeReferenceText(buildLotOptionValue(lot)) === normalizedValue
      );
    }) ?? null
  );
}

export function resolveLotProduct(
  products: readonly ProductLineItem[],
  lot: LotItem,
) {
  if (lot.productId) {
    const normalizedProductId = normalizeReferenceText(lot.productId);
    const productBySku = products.find(
      (product) => normalizeReferenceText(product.sku) === normalizedProductId,
    );

    if (productBySku) {
      return productBySku;
    }
  }

  return resolveProductSelection(products, lot.product);
}

export function isLotCompatibleWithProduct(
  lot: LotItem,
  product: ProductLineItem,
  products: readonly ProductLineItem[],
) {
  const lotProduct = resolveLotProduct(products, lot);

  if (lotProduct) {
    return normalizeReferenceText(lotProduct.sku) === normalizeReferenceText(product.sku);
  }

  return normalizeReferenceText(lot.product) === normalizeReferenceText(product.product);
}

export function resolveProductLotIdentity({
  productCatalog,
  lotCatalog,
  product,
  productId,
  lotCode,
  currentProduct,
  currentProductId,
  currentLotCode,
  messages,
}: ResolveProductLotIdentityInput) {
  const matchedProduct =
    (productId
      ? productCatalog.find(
          (catalogProduct) =>
            normalizeReferenceText(catalogProduct.sku) === normalizeReferenceText(productId),
        ) ?? null
      : null) ?? resolveProductSelection(productCatalog, product);
  const matchedLot = resolveLotSelection(lotCatalog, lotCode ?? "");
  const shouldPreserveCurrentProductId =
    !matchedProduct &&
    !!currentProductId &&
    normalizeReferenceText(product) === normalizeReferenceText(currentProduct ?? "");
  const shouldPreserveCurrentLotCode =
    !matchedLot &&
    !!currentLotCode &&
    normalizeReferenceText(lotCode ?? "") === normalizeReferenceText(currentLotCode);
  const resolvedProductId = matchedProduct?.sku ?? (shouldPreserveCurrentProductId ? currentProductId : undefined);
  const resolvedLotCode = matchedLot?.code ?? (shouldPreserveCurrentLotCode ? currentLotCode : undefined);
  const errors: Partial<Record<"product" | "lotCode", string>> = {};

  if (matchedProduct && !resolvedProductId) {
    errors.product = messages.productIdRequired;
  }

  if (matchedLot && !resolvedLotCode) {
    errors.lotCode = messages.lotCodeRequired;
  }

  if (matchedLot && matchedProduct && !isLotCompatibleWithProduct(matchedLot, matchedProduct, productCatalog)) {
    errors.lotCode = messages.lotProductMismatch;
  }

  return {
    matchedProduct,
    matchedLot,
    productId: resolvedProductId,
    lotCode: resolvedLotCode,
    errors,
  };
}

export function getInventoryErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function fetchLocationStockBalancesWithFallback(
  movements: readonly MovementItem[],
): Promise<LocationStockBalanceResolution> {
  try {
    return {
      balances: buildLocationStockBalanceMap(await fetchLocationStockBalances()),
      isUsingFallback: false,
    };
  } catch {
    return {
      balances: buildLocalLocationStockBalanceMap(movements),
      isUsingFallback: true,
    };
  }
}

export async function refreshLocationStockBalancesWithFallback(
  movements: readonly MovementItem[],
): Promise<LocationStockBalanceResolution> {
  try {
    return {
      balances: buildLocationStockBalanceMap(await refreshLocationStockBalances()),
      isUsingFallback: false,
    };
  } catch {
    return {
      balances: buildLocalLocationStockBalanceMap(movements),
      isUsingFallback: true,
    };
  }
}

export async function loadMovementsWithStockRefresh(): Promise<MovementsWithStockResolution> {
  const movements = loadMovements();

  return {
    movements,
    stock: await refreshLocationStockBalancesWithFallback(movements),
  };
}

export async function reloadMovementsWithStockAfterConflict(): Promise<MovementsWithStockResolution> {
  let movements = loadMovements();

  try {
    movements = await refreshMovements();
  } catch {
    movements = loadMovements();
  }

  return {
    movements,
    stock: await refreshLocationStockBalancesWithFallback(movements),
  };
}

export async function resolveValidationLocationStockBalances({
  movements,
  currentMovement,
  editingId,
}: {
  movements: readonly MovementItem[];
  currentMovement: MovementItem | null;
  editingId: string | null;
}): Promise<ValidationLocationStockBalanceResolution> {
  try {
    const balances = buildLocationStockBalanceMap(
      await fetchLocationStockBalances(),
    );

    return {
      balances,
      validationBalances: revertMovementFromLocationStockBalances(balances, currentMovement),
      isUsingFallback: false,
    };
  } catch {
    const fallbackMovements = editingId
      ? movements.filter((movement) => movement.id !== editingId)
      : movements;

    return {
      balances: buildLocalLocationStockBalanceMap(movements),
      validationBalances: buildLocalLocationStockBalanceMap(fallbackMovements),
      isUsingFallback: true,
    };
  }
}

function applyLocationStockDelta(
  balances: Map<string, number>,
  locationId: string | undefined,
  delta: number,
) {
  if (!locationId || delta === 0) {
    return;
  }

  balances.set(locationId, (balances.get(locationId) ?? 0) + delta);
}

function getTransferStockStatus(movement: Pick<MovementItem, "transferStatus">) {
  return movement.transferStatus ?? "recebida";
}

function isMovementCancelledForStock(movement: MovementItem) {
  if (movement.type === "transferencia") {
    return getTransferStockStatus(movement) === "cancelada";
  }

  return (movement.status ?? "concluida") === "cancelada";
}

export function buildLocalLocationStockBalanceMap(
  movements: readonly MovementItem[],
): LocationStockBalanceMap {
  const balances = new Map<string, number>();

  for (const movement of movements) {
    if (isMovementCancelledForStock(movement)) {
      continue;
    }

    if (movement.type === "entrada") {
      applyLocationStockDelta(balances, movement.locationId, movement.quantity);
      continue;
    }

    if (movement.type === "saida") {
      applyLocationStockDelta(balances, movement.locationId, -movement.quantity);
      continue;
    }

    const transferStatus = getTransferStockStatus(movement);

    if (transferStatus === "em_transito" || transferStatus === "recebida") {
      applyLocationStockDelta(balances, movement.fromLocationId, -movement.quantity);
    }

    if (transferStatus === "recebida") {
      applyLocationStockDelta(balances, movement.toLocationId, movement.quantity);
    }
  }

  return balances;
}

export function revertMovementFromLocationStockBalances(
  balances: ReadonlyMap<string, number>,
  movement: MovementItem | null,
): LocationStockBalanceMap {
  const adjusted = new Map(balances);

  if (!movement || isMovementCancelledForStock(movement)) {
    return adjusted;
  }

  if (movement.type === "entrada") {
    applyLocationStockDelta(adjusted, movement.locationId, -movement.quantity);
    return adjusted;
  }

  if (movement.type === "saida") {
    applyLocationStockDelta(adjusted, movement.locationId, movement.quantity);
    return adjusted;
  }

  const transferStatus = getTransferStockStatus(movement);

  if (transferStatus === "em_transito" || transferStatus === "recebida") {
    applyLocationStockDelta(adjusted, movement.fromLocationId, movement.quantity);
  }

  if (transferStatus === "recebida") {
    applyLocationStockDelta(adjusted, movement.toLocationId, -movement.quantity);
  }

  return adjusted;
}

export function getLocationStockBalance(
  balances: ReadonlyMap<string, number>,
  locationId: string | undefined,
) {
  if (!locationId) {
    return 0;
  }

  return Math.max(0, balances.get(locationId) ?? 0);
}
