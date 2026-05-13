"use client";

import {
  useEffect,
  useState,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import { ERP_DATA_EVENT } from "@/lib/app-events";
import {
  loadLocations,
  loadMovements,
  normalizeReferenceText,
  normalizeSkuIdentifier,
  normalizeText,
  type LocationItem,
  type MovementItem,
} from "@/lib/inventory";
import type { LotItem, ProductLineItem, SupplierItem } from "@/lib/operations-data";

export function FilterBar({
  placeholder,
  query,
  onQueryChange,
  trailing,
}: {
  placeholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_10px_24px_var(--shadow-color)]">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative block">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted-foreground)]"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={placeholder}
            className="h-12 w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-12 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
          />
        </label>
        {trailing ? <div className="flex flex-wrap gap-3">{trailing}</div> : null}
      </div>
    </div>
  );
}

export function Table({
  columns,
  children,
}: {
  columns: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel)]">
      <div
        className="hidden border-b border-[var(--panel-border)] bg-[var(--panel-soft)] px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)] lg:grid"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      <div className="divide-y divide-[var(--panel-border)]">{children}</div>
    </div>
  );
}

export function TableRow({
  columns,
  children,
}: {
  columns: number;
  children: ReactNode;
}) {
  return (
    <article
      className="grid gap-3 px-5 py-4 lg:items-center"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </article>
  );
}

export function toneByLabel(label: string) {
  const normalized = normalizeText(label);

  if (
    normalized.includes("critico") ||
    normalized.includes("desvio") ||
    normalized.includes("retido") ||
    normalized.includes("alta") ||
    normalized.includes("aberto")
  ) {
    return "bg-rose-50 text-rose-700";
  }

  if (
    normalized.includes("atencao") ||
    normalized.includes("em analise") ||
    normalized.includes("monitorado") ||
    normalized.includes("media") ||
    normalized.includes("em andamento") ||
    normalized.includes("aguardando")
  ) {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-emerald-50 text-emerald-700";
}

export function exportCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function TextareaInput(
  props: TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={`min-h-28 w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] ${props.className ?? ""}`.trim()}
    />
  );
}

export const PRODUCT_SPECIES_DOGS = "C\u00e3es" as ProductLineItem["species"];
export const PRODUCT_SPECIES_CATS = "Gatos" as ProductLineItem["species"];
export const PRODUCT_STATUS_STABLE = "Est\u00e1vel" as ProductLineItem["status"];
export const PRODUCT_STATUS_ATTENTION = "Aten\u00e7\u00e3o" as ProductLineItem["status"];
export const PRODUCT_STATUS_CRITICAL = "Cr\u00edtico" as ProductLineItem["status"];
export const LOT_STATUS_RELEASED = "Liberado" as LotItem["status"];
export const LOT_STATUS_IN_REVIEW = "Em an\u00e1lise" as LotItem["status"];
export const LOT_STATUS_HELD = "Retido" as LotItem["status"];
export const SUPPLIER_STATUS_APPROVED = "Homologado" as SupplierItem["status"];
export const SUPPLIER_STATUS_MONITORED = "Monitorado" as SupplierItem["status"];
export const SUPPLIER_STATUS_CRITICAL = "Cr\u00edtico" as SupplierItem["status"];
export const NOTIFICATION_STATUS_DONE = "Conclu\u00edda" as const;

export function resolveOperationalProductStatus(
  stock: number,
  target: number,
  coverageDays: number,
): ProductLineItem["status"] {
  if (coverageDays <= 7 || stock <= target * 0.5) {
    return PRODUCT_STATUS_CRITICAL;
  }

  if (coverageDays <= 14 || stock < target) {
    return PRODUCT_STATUS_ATTENTION;
  }

  return PRODUCT_STATUS_STABLE;
}

function getDerivedProductMovementDelta(movement: MovementItem) {
  if (movement.type === "transferencia") {
    const transferStatus = movement.transferStatus ?? "recebida";

    if (
      transferStatus === "cancelada" ||
      transferStatus === "solicitada" ||
      transferStatus === "em_separacao"
    ) {
      return 0;
    }

    if (transferStatus === "em_transito") {
      return -movement.quantity;
    }

    return 0;
  }

  if ((movement.status ?? "concluida") === "cancelada") {
    return 0;
  }

  return movement.type === "entrada" ? movement.quantity : -movement.quantity;
}

function getDerivedProductStock(
  products: ProductLineItem[],
  movements: MovementItem[],
) {
  if (movements.length === 0) {
    return new Map(
      products.map((product) => [product.sku, product.stock] as const),
    );
  }

  const totalsByProductId = new Map<
    string,
    { stock: number; hasEffectiveMovement: boolean }
  >();
  const totalsByProductName = new Map<
    string,
    { stock: number; hasEffectiveMovement: boolean }
  >();

  for (const movement of movements) {
    const delta = getDerivedProductMovementDelta(movement);

    if (delta !== 0) {
      if (movement.productId) {
        const normalizedProductId = normalizeSkuIdentifier(movement.productId);
        const currentById = totalsByProductId.get(normalizedProductId) ?? {
          stock: 0,
          hasEffectiveMovement: false,
        };
        currentById.stock += delta;
        currentById.hasEffectiveMovement = true;
        totalsByProductId.set(normalizedProductId, currentById);
        continue;
      }

      const normalizedProductName = normalizeReferenceText(movement.product);

      if (!normalizedProductName) {
        continue;
      }

      const currentByName = totalsByProductName.get(normalizedProductName) ?? {
        stock: 0,
        hasEffectiveMovement: false,
      };
      currentByName.stock += delta;
      currentByName.hasEffectiveMovement = true;
      totalsByProductName.set(normalizedProductName, currentByName);
    }
  }

  return new Map(
    products.map((product) => {
      const derivedById = totalsByProductId.get(
        normalizeSkuIdentifier(product.sku),
      );

      if (derivedById?.hasEffectiveMovement) {
        return [product.sku, derivedById.stock] as const;
      }

      const derivedByName = totalsByProductName.get(
        normalizeReferenceText(product.product),
      );

      if (!derivedByName?.hasEffectiveMovement) {
        return [product.sku, product.stock] as const;
      }

      return [product.sku, derivedByName.stock] as const;
    }),
  );
}

export function getProductsWithDerivedStock(
  products: ProductLineItem[],
  movements: MovementItem[],
) {
  const derivedStockBySku = getDerivedProductStock(products, movements);

  return products.map((product) => {
    const derivedStock = derivedStockBySku.get(product.sku) ?? product.stock;

    return {
      ...product,
      stock: derivedStock,
      status: resolveOperationalProductStatus(
        derivedStock,
        product.target,
        product.coverageDays,
      ),
    };
  });
}

export function useInventoryData() {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [movements, setMovements] = useState<MovementItem[]>([]);

  useEffect(() => {
    const sync = () => {
      setLocations(loadLocations());
      setMovements(loadMovements());
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(ERP_DATA_EVENT, sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(ERP_DATA_EVENT, sync);
    };
  }, []);

  return { locations, movements };
}
