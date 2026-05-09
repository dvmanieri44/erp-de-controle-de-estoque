import {
  findMatchingProductReference,
  normalizeReferenceText,
  type LocationStockBalanceMap,
  type MovementItem,
} from "@/lib/inventory";
import type { LotItem, ProductLineItem } from "@/lib/operations-data";

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
