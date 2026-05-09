"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ERP_DATA_EVENT } from "@/lib/app-events";
import {
  buildLocalLocationStockBalanceMap,
  buildLotOptionValue,
  buildProductOptionValue,
  fetchLocationStockBalancesWithFallback,
  getLocationStockBalance,
  getInventoryErrorMessage,
  loadMovementsWithStockRefresh,
  resolveLotProduct,
  resolveLotSelection,
  resolveProductLotIdentity,
  resolveProductSelection,
  resolveValidationLocationStockBalances,
  reloadMovementsWithStockAfterConflict,
  revertMovementFromLocationStockBalances,
  type LocationStockBalanceResolution,
} from "@/components/dashboard/inventory/movement-form-helpers";
import {
  DATE_RANGE_OPTIONS,
  MOVEMENT_TYPES,
  buildTransferCode,
  createMovement,
  deleteMovement,
  formatDateTime,
  formatSignedUnits,
  formatUnits,
  getMovementStatusLabel,
  getTransferPriorityLabel,
  isMovementCancelled,
  loadLocations,
  loadMovements,
  matchesDateRange,
  MovementVersionConflictError,
  normalizeText,
  refreshMovements,
  type DateRangeFilter,
  type LocationItem,
  type LocationStockBalanceMap,
  type MovementItem,
  type MovementStatus,
  type MovementType,
  type TransferPriority,
  type TransferStatus,
  type VersionedMovementItem,
  updateMovement,
} from "@/lib/inventory";
import { loadLots, loadProductLines } from "@/lib/operations-store";
import { useErpPermissions } from "@/lib/use-erp-permissions";

type ToastState = {
  id: number;
  message: string;
  tone: "success" | "error";
  actionLabel?: string;
  onAction?: () => void;
} | null;

type MovementFilter = MovementType | "todos";
type ActivityFilter = "all" | "active" | "cancelled";
type MovementSort = "newest" | "oldest" | "quantity_desc" | "quantity_asc" | "type";

type MovementFormState = {
  product: string;
  productId: string;
  lotCode: string;
  type: MovementType;
  quantity: string;
  reason: string;
  user: string;
  locationId: string;
  fromLocationId: string;
  toLocationId: string;
  notes: string;
  status: MovementStatus;
  transferStatus: TransferStatus;
  priority: TransferPriority;
};

type FormErrors = Partial<Record<keyof MovementFormState, string>>;

const EMPTY_FORM: MovementFormState = {
  product: "",
  productId: "",
  lotCode: "",
  type: "entrada",
  quantity: "",
  reason: "",
  user: "",
  locationId: "",
  fromLocationId: "",
  toLocationId: "",
  notes: "",
  status: "concluida",
  transferStatus: "recebida",
  priority: "media",
};

const MOVEMENT_STALE_VERSION_MESSAGE =
  "Sem versao local confiavel para esta movimentacao. Recarreguei a lista e nao salvei nada para evitar sobrescrita. Abra a movimentacao novamente e tente outra vez.";
const MOVEMENT_VERSION_CONFLICT_MESSAGE =
  "Conflito de versao: esta movimentacao foi alterada por outra sessao. Recarreguei a lista e nao salvei sua alteracao para evitar sobrescrita. Revise os dados e tente novamente.";
const PRODUCT_ID_REQUIRED_MESSAGE =
  "Produto reconhecido no catalogo, mas sem SKU vinculado. Selecione o produto novamente antes de salvar.";
const LOT_CODE_REQUIRED_MESSAGE =
  "Lote reconhecido no catalogo, mas sem codigo vinculado. Selecione o lote novamente antes de salvar.";
const LOT_PRODUCT_MISMATCH_MESSAGE =
  "O lote selecionado pertence a outro produto. Ajuste produto ou lote antes de salvar.";

function MetricCard({
  title,
  value,
  tone = "default",
  helper,
  onClick,
  active = false,
}: {
  title: string;
  value: string;
  tone?: "default" | "positive" | "negative";
  helper?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-red-500"
        : "text-[var(--navy-900)]";

  const className = `rounded-2xl border bg-[var(--panel)] p-4 shadow-[0_6px_18px_var(--shadow-color)] transition ${
    active ? "border-[var(--accent)] ring-2 ring-[var(--accent-soft)]" : "border-[var(--panel-border)]"
  } ${onClick ? "cursor-pointer hover:border-[var(--accent)]" : ""}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} text-left`}>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{title}</p>
        <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
        {helper ? <p className="mt-1 text-xs text-[var(--muted-foreground)]">{helper}</p> : null}
      </button>
    );
  }

  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{title}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {helper ? <p className="mt-1 text-xs text-[var(--muted-foreground)]">{helper}</p> : null}
    </div>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">{label}</span>
      {children}
      {error ? <span className="mt-1.5 block text-xs text-[#dc2626]">{error}</span> : null}
    </label>
  );
}

function Toast({ toast }: { toast: NonNullable<ToastState> }) {
  return (
    <div
      className={`fixed right-4 top-4 z-50 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
        toast.tone === "success" ? "bg-emerald-600" : "bg-red-600"
      }`}
      role="status"
      aria-live="polite"
    >
      <span>{toast.message}</span>
      {toast.actionLabel && toast.onAction ? (
        <button type="button" onClick={toast.onAction} className="rounded-lg bg-white/15 px-2.5 py-1 text-xs font-semibold">
          {toast.actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function StatusBadge({ movement }: { movement: MovementItem }) {
  const label = getMovementStatusLabel(movement);
  const isCancelled = isMovementCancelled(movement);
  const tone = isCancelled
    ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
    : movement.type === "transferencia"
      ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
      : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function MovementTypeBadge({ type }: { type: MovementType }) {
  const config =
    type === "entrada"
      ? "bg-emerald-100 text-emerald-700"
      : type === "saida"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";

  return (
    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${config}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        {type === "entrada" ? (
          <>
            <path d="M12 5v14" />
            <path d="m7 10 5-5 5 5" />
          </>
        ) : type === "saida" ? (
          <>
            <path d="M12 19V5" />
            <path d="m17 14-5 5-5-5" />
          </>
        ) : (
          <>
            <path d="M4 7h12" />
            <path d="m13 4 3 3-3 3" />
            <path d="M20 17H8" />
            <path d="m11 14-3 3 3 3" />
          </>
        )}
      </svg>
    </div>
  );
}

function ActionButton({
  children,
  label,
  onClick,
  tone = "default",
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
        tone === "danger"
          ? "text-[#ef4444] hover:bg-[#fee2e2]"
          : "text-[var(--accent)] hover:bg-[var(--accent-soft)]"
      }`}
    >
      {children}
    </button>
  );
}

function findLocationName(locations: LocationItem[], id?: string) {
  return locations.find((location) => location.id === id)?.name ?? "Local não encontrado";
}

function getMovementLocationLabel(movement: MovementItem, locations: LocationItem[]) {
  if (movement.type === "transferencia") {
    return `${findLocationName(locations, movement.fromLocationId)} -> ${findLocationName(locations, movement.toLocationId)}`;
  }

  return findLocationName(locations, movement.locationId);
}

function exportCsv(filename: string, rows: string[][]) {
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

function getMovementDisplayQuantity(movement: MovementItem) {
  return movement.type === "saida" ? -movement.quantity : movement.quantity;
}

function MovementListItem({
  movement,
  locations,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  movement: MovementItem;
  locations: LocationItem[];
  expanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const quantity = getMovementDisplayQuantity(movement);
  const amountClass =
    movement.type === "entrada"
      ? "text-emerald-600"
      : movement.type === "saida"
        ? "text-red-500"
        : "text-amber-600";

  return (
    <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_6px_18px_var(--shadow-color)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <MovementTypeBadge type={movement.type} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-[var(--navy-900)]">{movement.product}</h3>
              <StatusBadge movement={movement} />
              {movement.type === "transferencia" && movement.priority ? (
                <span className="inline-flex rounded-full bg-[var(--panel-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
                  Prioridade {getTransferPriorityLabel(movement.priority)}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{movement.reason}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
              <span>{formatDateTime(movement.createdAt)}</span>
              <span>Por {movement.user}</span>
              <span>{getMovementLocationLabel(movement, locations)}</span>
              {movement.code ? <span>{movement.code}</span> : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-start gap-2">
          <p className={`text-lg font-semibold ${amountClass}`}>{formatSignedUnits(quantity)}</p>
          <div className="flex gap-1">
            <ActionButton label={`Detalhes de ${movement.product}`} onClick={onToggle}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path d={expanded ? "M6 15l6-6 6 6" : "m6 9 6 6 6-6"} />
              </svg>
            </ActionButton>
            {onEdit ? (
              <ActionButton label={`Editar ${movement.product}`} onClick={onEdit}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                  <path d="M4 20h4l10-10-4-4L4 16v4Z" />
                  <path d="m12.5 7.5 4 4" />
                </svg>
              </ActionButton>
            ) : null}
            {onDelete ? (
              <ActionButton label={`Excluir ${movement.product}`} onClick={onDelete} tone="danger">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                  <path d="M5 7h14" />
                  <path d="M9 7V5h6v2" />
                  <path d="M8 10v7M12 10v7M16 10v7" />
                  <path d="M6 7l1 12h10l1-12" />
                </svg>
              </ActionButton>
            ) : null}
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 grid gap-3 rounded-2xl bg-[var(--panel-soft)] p-4 text-sm text-[var(--muted-foreground)] md:grid-cols-2">
          <div>
            <p className="font-semibold text-[var(--foreground)]">Resumo</p>
            <p className="mt-2">Tipo: {movement.type}</p>
            <p>Status: {getMovementStatusLabel(movement)}</p>
            <p>Quantidade: {formatUnits(movement.quantity)}</p>
            {movement.updatedAt ? <p>Última atualização: {formatDateTime(movement.updatedAt)}</p> : null}
          </div>
          <div>
            <p className="font-semibold text-[var(--foreground)]">Detalhes</p>
            <p className="mt-2">Local: {getMovementLocationLabel(movement, locations)}</p>
            {movement.notes ? <p>Observações: {movement.notes}</p> : null}
            {movement.receivedAt ? <p>Recebida em: {formatDateTime(movement.receivedAt)}</p> : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function MovementsScreen() {
  const { canCreate, canDelete, canUpdate } = useErpPermissions();
  const canCreateMovements = canCreate("inventory.movements");
  const canDeleteMovements = canDelete("inventory.movements");
  const canUpdateMovements = canUpdate("inventory.movements");
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [movements, setMovements] = useState<VersionedMovementItem[]>([]);
  const [locationStockBalances, setLocationStockBalances] = useState<LocationStockBalanceMap>(() => new Map());
  const [isUsingStockFallback, setIsUsingStockFallback] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<MovementFilter>("todos");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all");
  const [locationFilter, setLocationFilter] = useState("todos");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [sortBy, setSortBy] = useState<MovementSort>("newest");
  const [visibleCount, setVisibleCount] = useState(10);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VersionedMovementItem | null>(null);
  const [form, setForm] = useState<MovementFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState<ToastState>(null);
  const [productCatalog, setProductCatalog] = useState(() => loadProductLines());
  const [lotCatalog, setLotCatalog] = useState(() => loadLots());
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const fallbackWarningShownRef = useRef(false);

  function applyStockResolution(stockResolution: LocationStockBalanceResolution) {
    setLocationStockBalances(stockResolution.balances);
    setIsUsingStockFallback(stockResolution.isUsingFallback);

    if (!stockResolution.isUsingFallback) {
      fallbackWarningShownRef.current = false;
    }
  }

  useEffect(() => {
    let isActive = true;

    async function syncLocationStock(nextMovements: VersionedMovementItem[]) {
      const stockResolution = await fetchLocationStockBalancesWithFallback(nextMovements);

      if (!isActive) {
        return;
      }

      applyStockResolution(stockResolution);

      if (stockResolution.isUsingFallback && !fallbackWarningShownRef.current) {
        fallbackWarningShownRef.current = true;
        setToast({
          id: Date.now(),
          message: "Nao foi possivel carregar o saldo consolidado. O formulario esta usando fallback local temporariamente.",
          tone: "error",
        });
      }
    }

    try {
      const nextLocations = loadLocations();
      const nextMovements = loadMovements();
      setLocations(nextLocations);
      setMovements(nextMovements);
      setProductCatalog(loadProductLines());
      setLotCatalog(loadLots());
      void syncLocationStock(nextMovements);
    } catch {
      setToast({
        id: Date.now(),
        message: "Não foi possível carregar as movimentações salvas.",
        tone: "error",
      });
    }

    function syncInventory() {
      try {
        if (!isActive) {
          return;
        }

        const nextLocations = loadLocations();
        const nextMovements = loadMovements();
        setLocations(nextLocations);
        setMovements(nextMovements);
        setProductCatalog(loadProductLines());
        setLotCatalog(loadLots());
        void syncLocationStock(nextMovements);
      } catch {
        if (!isActive) {
          return;
        }

        setToast({
          id: Date.now(),
          message: "Não foi possível sincronizar os dados.",
          tone: "error",
        });
      }
    }

    async function syncInventoryFromServer() {
      try {
        const nextMovements = await refreshMovements();

        if (!isActive) {
          return;
        }

        setLocations(loadLocations());
        setMovements(nextMovements);
        setProductCatalog(loadProductLines());
        setLotCatalog(loadLots());
        await syncLocationStock(nextMovements);
      } catch {
        if (!isActive) {
          return;
        }

        setToast({
          id: Date.now(),
          message: "Não foi possível carregar as movimentações salvas.",
          tone: "error",
        });
      }
    }

    void syncInventoryFromServer();
    window.addEventListener("storage", syncInventory);
    window.addEventListener(ERP_DATA_EVENT, syncInventory);
    return () => {
      isActive = false;
      window.removeEventListener("storage", syncInventory);
      window.removeEventListener(ERP_DATA_EVENT, syncInventory);
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    setVisibleCount(10);
  }, [search, selectedType, dateRange, locationFilter, activityFilter, sortBy]);

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    firstFieldRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeModal();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  useEffect(() => {
    if (!deleteTarget) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDeleteTarget(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteTarget]);

  const filteredMovements = useMemo(() => {
    const query = normalizeText(search);
    const byType = movements.filter((movement) => selectedType === "todos" || movement.type === selectedType);
    const byDate = byType.filter((movement) => matchesDateRange(movement.createdAt, dateRange));
    const byLocation = byDate.filter((movement) => {
      if (locationFilter === "todos") {
        return true;
      }

      return (
        movement.locationId === locationFilter ||
        movement.fromLocationId === locationFilter ||
        movement.toLocationId === locationFilter
      );
    });
    const byActivity = byLocation.filter((movement) => {
      if (activityFilter === "all") {
        return true;
      }

      return activityFilter === "cancelled" ? isMovementCancelled(movement) : !isMovementCancelled(movement);
    });

    return byActivity
      .filter((movement) => {
        if (!query) {
          return true;
        }

        return normalizeText(
          [
            movement.product,
            movement.reason,
            movement.user,
            movement.notes ?? "",
            movement.code ?? "",
            getMovementStatusLabel(movement),
            getMovementLocationLabel(movement, locations),
          ].join(" "),
        ).includes(query);
      })
      .sort((left, right) => {
        if (sortBy === "oldest") {
          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        }

        if (sortBy === "quantity_desc") {
          return right.quantity - left.quantity;
        }

        if (sortBy === "quantity_asc") {
          return left.quantity - right.quantity;
        }

        if (sortBy === "type") {
          return left.type.localeCompare(right.type);
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
  }, [activityFilter, dateRange, locationFilter, locations, movements, search, selectedType, sortBy]);

  const visibleMovements = filteredMovements.slice(0, visibleCount);

  const metrics = useMemo(() => {
    const activeMovements = movements.filter((movement) => !isMovementCancelled(movement));
    const entries = activeMovements
      .filter((movement) => movement.type === "entrada")
      .reduce((sum, movement) => sum + movement.quantity, 0);
    const exits = activeMovements
      .filter((movement) => movement.type === "saida")
      .reduce((sum, movement) => sum + movement.quantity, 0);
    const transfers = activeMovements.filter((movement) => movement.type === "transferencia").length;
    const cancelled = movements.filter((movement) => isMovementCancelled(movement)).length;

    return {
      total: movements.length,
      entries,
      exits,
      transfers,
      cancelled,
    };
  }, [movements]);

  const currentMovement = useMemo(
    () => (editingId ? movements.find((movement) => movement.id === editingId) ?? null : null),
    [editingId, movements],
  );

  const formStockBalances = useMemo(
    () => revertMovementFromLocationStockBalances(locationStockBalances, currentMovement),
    [currentMovement, locationStockBalances],
  );

  const getLocationUsedCapacity = (
    locationId: string,
    candidateMovements?: readonly MovementItem[],
  ) => {
    if (isUsingStockFallback) {
      const fallbackBalances = candidateMovements
        ? buildLocalLocationStockBalanceMap(candidateMovements)
        : locationStockBalances;
      return getLocationStockBalance(fallbackBalances, locationId);
    }

    const balances = candidateMovements ? formStockBalances : locationStockBalances;
    return getLocationStockBalance(balances, locationId);
  };

  const getLocationAvailableCapacity = (
    location: LocationItem,
    candidateMovements?: readonly MovementItem[],
  ) => Math.max(0, location.capacityTotal - getLocationUsedCapacity(location.id, candidateMovements));

  function handleProductChange(value: string) {
    const matchedProduct = resolveProductSelection(productCatalog, value);

    setForm((current) => ({
      ...current,
      product: matchedProduct?.product ?? value,
      productId: matchedProduct?.sku ?? "",
    }));
  }

  function handleLotChange(value: string) {
    const matchedLot = resolveLotSelection(lotCatalog, value);
    const matchedProduct = matchedLot ? resolveLotProduct(productCatalog, matchedLot) : null;

    setForm((current) => ({
      ...current,
      lotCode: matchedLot?.code ?? value,
      product: matchedProduct?.product ?? current.product,
      productId: matchedProduct?.sku ?? current.productId,
    }));
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function openModal(movement?: MovementItem) {
    if (movement && !canUpdateMovements) {
      setToast({
        id: Date.now(),
        message: "Seu perfil nao pode editar movimentacoes.",
        tone: "error",
      });
      return;
    }

    if (!movement && !canCreateMovements) {
      setToast({
        id: Date.now(),
        message: "Seu perfil nao pode criar movimentacoes.",
        tone: "error",
      });
      return;
    }

    if (!movement && locations.length === 0) {
      setToast({
        id: Date.now(),
        message: "Cadastre pelo menos uma localizacao antes de movimentar estoque.",
        tone: "error",
      });
      return;
    }

    setIsModalOpen(true);
    setEditingId(movement?.id ?? null);
    setForm({
      product: movement?.product ?? "",
      productId: movement?.productId ?? "",
      lotCode: movement?.lotCode ?? "",
      type: movement?.type ?? "entrada",
      quantity: movement ? String(movement.quantity) : "",
      reason: movement?.reason ?? "",
      user: movement?.user ?? "",
      locationId: movement?.locationId ?? locations[0]?.id ?? "",
      fromLocationId: movement?.fromLocationId ?? locations[0]?.id ?? "",
      toLocationId: movement?.toLocationId ?? locations[1]?.id ?? locations[0]?.id ?? "",
      notes: movement?.notes ?? "",
      status: movement?.status ?? "concluida",
      transferStatus: movement?.transferStatus ?? "recebida",
      priority: movement?.priority ?? "media",
    });
    setErrors({});
  }

  function validateForm(
    values: MovementFormState,
    stockBalances: ReadonlyMap<string, number>,
  ) {
    const nextErrors: FormErrors = {};
    const quantity = Number(values.quantity);

    if (!values.product.trim()) {
      nextErrors.product = "Informe o produto movimentado.";
    }

    if (!values.reason.trim()) {
      nextErrors.reason = "Informe o motivo da movimentação.";
    }

    if (!values.user.trim()) {
      nextErrors.user = "Informe o usuário responsável.";
    }

    if (!values.quantity.trim()) {
      nextErrors.quantity = "Informe a quantidade.";
    } else if (!Number.isFinite(quantity) || quantity <= 0) {
      nextErrors.quantity = "Use um valor numérico maior que zero.";
    }

    if (values.type === "entrada" || values.type === "saida") {
      if (!values.locationId) {
        nextErrors.locationId = "Selecione a localização.";
      }
    }

    if (values.type === "transferencia") {
      if (!values.fromLocationId) {
        nextErrors.fromLocationId = "Selecione a origem.";
      }

      if (!values.toLocationId) {
        nextErrors.toLocationId = "Selecione o destino.";
      }

      if (values.fromLocationId && values.toLocationId && values.fromLocationId === values.toLocationId) {
        nextErrors.toLocationId = "Origem e destino precisam ser diferentes.";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      return nextErrors;
    }

    if (values.type === "saida" && values.status !== "cancelada") {
      const location = locations.find((item) => item.id === values.locationId);

      if (!location) {
        nextErrors.locationId = "Localização inválida.";
        return nextErrors;
      }

      const availableStock = getLocationStockBalance(stockBalances, location.id);

      if (quantity > availableStock) {
        nextErrors.quantity = `A localização possui apenas ${formatUnits(availableStock)} em saldo para saída.`;
      }
    }

    if (values.type === "transferencia" && values.transferStatus !== "cancelada") {
      const fromLocation = locations.find((item) => item.id === values.fromLocationId);

      if (!fromLocation) {
        nextErrors.fromLocationId = "Selecione localizações válidas.";
        return nextErrors;
      }

      if (
        values.transferStatus === "solicitada" ||
        values.transferStatus === "em_separacao"
      ) {
        return nextErrors;
      }

      const availableStock = getLocationStockBalance(stockBalances, fromLocation.id);

      if (quantity > availableStock) {
        nextErrors.quantity = `A origem possui apenas ${formatUnits(availableStock)} em saldo para transferência.`;
      }
    }

    return nextErrors;
  }

  async function reloadMovementsAfterConflict(message: string) {
    const result = await reloadMovementsWithStockAfterConflict();
    setMovements(result.movements);
    applyStockResolution(result.stock);

    setToast({
      id: Date.now(),
      message,
      tone: "error",
    });
  }

  async function resolveValidationStockBalances() {
    const stockResolution = await resolveValidationLocationStockBalances({
      movements,
      currentMovement,
      editingId,
    });
    applyStockResolution(stockResolution);

    if (!stockResolution.isUsingFallback) {
      return stockResolution.validationBalances;
    }

    if (!fallbackWarningShownRef.current) {
      fallbackWarningShownRef.current = true;
      setToast({
        id: Date.now(),
        message:
          "Nao foi possivel carregar o saldo consolidado. O formulario esta usando fallback local temporariamente.",
        tone: "error",
      });
    }

    return stockResolution.validationBalances;
  }

  async function restoreMovement(removed: VersionedMovementItem) {
    try {
      await createMovement(removed);
      const result = await loadMovementsWithStockRefresh();
      setMovements(result.movements);
      applyStockResolution(result.stock);
    } catch (error) {
      setToast({
        id: Date.now(),
        message: getInventoryErrorMessage(error, "Nao foi possivel restaurar a movimentacao."),
        tone: "error",
      });
    }
  }

  async function handleSubmit() {
    if (editingId && !canUpdateMovements) {
      setToast({
        id: Date.now(),
        message: "Seu perfil nao pode editar movimentacoes.",
        tone: "error",
      });
      return;
    }

    if (!editingId && !canCreateMovements) {
      setToast({
        id: Date.now(),
        message: "Seu perfil nao pode criar movimentacoes.",
        tone: "error",
      });
      return;
    }

    const stockBalances = await resolveValidationStockBalances();
    const nextErrors = validateForm(form, stockBalances);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const now = new Date().toISOString();
    const quantity = Number(form.quantity);
    const identity = resolveProductLotIdentity({
      productCatalog,
      lotCatalog,
      product: form.product,
      productId: form.productId,
      lotCode: form.lotCode,
      currentProduct: currentMovement?.product,
      currentProductId: currentMovement?.productId,
      currentLotCode: currentMovement?.lotCode,
      messages: {
        productIdRequired: PRODUCT_ID_REQUIRED_MESSAGE,
        lotCodeRequired: LOT_CODE_REQUIRED_MESSAGE,
        lotProductMismatch: LOT_PRODUCT_MISMATCH_MESSAGE,
      },
    });
    const identityErrors: FormErrors = identity.errors;

    if (Object.keys(identityErrors).length > 0) {
      setErrors((current) => ({ ...current, ...identityErrors }));
      return;
    }

    const movement: VersionedMovementItem = {
      id: editingId ?? `mov-${Date.now()}`,
      product: identity.matchedProduct?.product ?? form.product.trim(),
      productId: identity.productId,
      lotCode: identity.lotCode,
      type: form.type,
      quantity,
      reason: form.reason.trim(),
      user: form.user.trim(),
      createdAt: currentMovement?.createdAt ?? now,
      updatedAt: editingId ? now : undefined,
      notes: form.notes.trim() || undefined,
      status: form.type === "transferencia" ? undefined : form.status,
      transferStatus: form.type === "transferencia" ? form.transferStatus : undefined,
      priority: form.type === "transferencia" ? form.priority : undefined,
      code:
        form.type === "transferencia"
          ? currentMovement?.code ?? buildTransferCode(new Date())
          : undefined,
      receivedAt:
        form.type === "transferencia" && form.transferStatus === "recebida"
          ? currentMovement?.receivedAt ?? now
          : undefined,
      version: currentMovement?.version,
      ...(form.type === "transferencia"
        ? {
            fromLocationId: form.fromLocationId,
            toLocationId: form.toLocationId,
          }
        : {
            locationId: form.locationId,
          }),
    };

    try {
      if (editingId) {
        if (typeof currentMovement?.version !== "number") {
          await reloadMovementsAfterConflict(
            MOVEMENT_STALE_VERSION_MESSAGE,
          );
          return;
        }

        await updateMovement(editingId, movement, currentMovement.version);
      } else {
        await createMovement(movement);
      }

      const result = await loadMovementsWithStockRefresh();
      setMovements(result.movements);
      applyStockResolution(result.stock);

      setToast({
        id: Date.now(),
        message: editingId ? "Movimentação atualizada com sucesso." : "Movimentação registrada com sucesso.",
        tone: "success",
      });
      closeModal();
    } catch (error) {
      if (error instanceof MovementVersionConflictError) {
        await reloadMovementsAfterConflict(
          MOVEMENT_VERSION_CONFLICT_MESSAGE,
        );
        closeModal();
        return;
      }

      setToast({
        id: Date.now(),
        message: getInventoryErrorMessage(error, "Não foi possível salvar a movimentação."),
        tone: "error",
      });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    if (!canDeleteMovements) {
      setDeleteTarget(null);
      setToast({
        id: Date.now(),
        message: "Seu perfil nao pode excluir movimentacoes.",
        tone: "error",
      });
      return;
    }

    const removed = deleteTarget;
    setDeleteTarget(null);

    try {
      if (typeof removed.version !== "number") {
        await reloadMovementsAfterConflict(
          MOVEMENT_STALE_VERSION_MESSAGE,
        );
        return;
      }

      await deleteMovement(removed.id, removed.version);
      const result = await loadMovementsWithStockRefresh();
      setMovements(result.movements);
      applyStockResolution(result.stock);

      setToast({
        id: Date.now(),
        message: "Movimentação excluída com sucesso.",
        tone: "success",
        actionLabel: "Desfazer",
        onAction: () => {
          void restoreMovement(removed);
        },
      });
    } catch (error) {
      if (error instanceof MovementVersionConflictError) {
        await reloadMovementsAfterConflict(
          MOVEMENT_VERSION_CONFLICT_MESSAGE,
        );
        return;
      }

      setToast({
        id: Date.now(),
        message: getInventoryErrorMessage(error, "Não foi possível excluir a movimentação."),
        tone: "error",
      });
      setDeleteTarget(removed);
    }
  }

  function handleExport() {
    exportCsv("movimentacoes.csv", [
      ["Produto", "Tipo", "Status", "Quantidade", "Local", "Motivo", "Usuario", "Data", "Codigo"],
      ...filteredMovements.map((movement) => [
        movement.product,
        movement.type,
        getMovementStatusLabel(movement),
        String(movement.quantity),
        getMovementLocationLabel(movement, locations),
        movement.reason,
        movement.user,
        formatDateTime(movement.createdAt),
        movement.code ?? "",
      ]),
    ]);
  }

  const hasLocationsForMovement = locations.length > 0;
  const canCreateMovement = canCreateMovements && hasLocationsForMovement;

  return (
    <section className="relative space-y-6 pb-8">
      {toast ? <Toast toast={toast} /> : null}

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <header>
          <h1 className="text-[30px] font-semibold tracking-[-0.02em] text-[var(--navy-900)]">Movimentações</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Histórico operacional com filtros, edição segura e impacto automático nas localizações</p>
        </header>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M4 21h16" />
            </svg>
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => openModal()}
            disabled={!canCreateMovement}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
              canCreateMovement ? "bg-[var(--accent)] hover:opacity-95" : "cursor-not-allowed bg-slate-300 shadow-none"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nova movimentação
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Total" value={String(metrics.total)} helper="Todos os registros" onClick={() => setActivityFilter("all")} active={activityFilter === "all"} />
        <MetricCard title="Entradas" value={formatSignedUnits(metrics.entries)} tone="positive" helper="Registros ativos" onClick={() => setSelectedType("entrada")} active={selectedType === "entrada"} />
        <MetricCard title="Saídas" value={formatSignedUnits(-metrics.exits)} tone="negative" helper="Registros ativos" onClick={() => setSelectedType("saida")} active={selectedType === "saida"} />
        <MetricCard title="Transferências" value={String(metrics.transfers)} helper="Fluxo entre locais" onClick={() => setSelectedType("transferencia")} active={selectedType === "transferencia"} />
        <MetricCard title="Canceladas" value={String(metrics.cancelled)} helper="Sem impacto na capacidade" onClick={() => setActivityFilter("cancelled")} active={activityFilter === "cancelled"} />
      </div>

      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_6px_18px_var(--shadow-color)]">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px_220px_220px]">
          <Field label="Buscar">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Produto, motivo, usuário, código ou localização"
              className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
            />
          </Field>

          <Field label="Período">
            <select
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value as DateRangeFilter)}
              className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
            >
              {DATE_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tipo">
            <select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value as MovementFilter)}
              className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
            >
              {MOVEMENT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Localização">
            <select
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
            >
              <option value="todos">Todas</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Ordenar por">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as MovementSort)}
              className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
            >
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigas</option>
              <option value="quantity_desc">Maior quantidade</option>
              <option value="quantity_asc">Menor quantidade</option>
              <option value="type">Tipo</option>
            </select>
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { value: "all", label: "Todas" },
            { value: "active", label: "Ativas" },
            { value: "cancelled", label: "Canceladas" },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setActivityFilter(item.value as ActivityFilter)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activityFilter === item.value
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--panel-soft)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {!canCreateMovement ? (
        <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)] px-5 py-10 text-center">
          <p className="text-sm font-medium text-[var(--foreground)]">
            {hasLocationsForMovement
              ? "Seu perfil nao pode criar movimentacoes."
              : "Cadastre pelo menos uma localização antes de movimentar estoque."}
          </p>
        </div>
      ) : null}

      <div className="space-y-4">
        {visibleMovements.map((movement) => (
          <MovementListItem
            key={movement.id}
            movement={movement}
            locations={locations}
            expanded={expandedIds.includes(movement.id)}
            onToggle={() =>
              setExpandedIds((current) =>
                current.includes(movement.id) ? current.filter((id) => id !== movement.id) : [...current, movement.id],
              )
            }
            onEdit={canUpdateMovements ? () => openModal(movement) : undefined}
            onDelete={canDeleteMovements ? () => setDeleteTarget(movement) : undefined}
          />
        ))}
      </div>

      {filteredMovements.length > visibleCount ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((current) => current + 10)}
            className="rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]"
          >
            Mostrar mais
          </button>
        </div>
      ) : null}

      {filteredMovements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)] px-5 py-10 text-center">
          <p className="text-sm font-medium text-[var(--foreground)]">Nenhuma movimentação encontrada</p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Ajuste a busca, altere os filtros ou registre uma nova movimentação.
          </p>
        </div>
      ) : null}

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="w-full max-w-4xl rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--navy-900)]">
                  {editingId ? "Editar movimentação" : "Nova movimentação"}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Cadastre entradas, saídas ou transferências com regras de capacidade e rastreabilidade.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--panel-border)] text-[var(--muted-foreground)] transition hover:bg-[var(--panel-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                aria-label="Fechar formulário"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Produto" error={errors.product}>
                <input
                  ref={firstFieldRef}
                  value={form.product}
                  onChange={(event) => handleProductChange(event.target.value)}
                  list="movement-product-options"
                  placeholder="Ex.: GoldeN Formula Gatos Castrados"
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                />
                <datalist id="movement-product-options">
                  {productCatalog.map((product) => (
                    <option key={product.sku} value={buildProductOptionValue(product)} />
                  ))}
                </datalist>
              </Field>

              <Field label="Lote (opcional)" error={errors.lotCode}>
                <input
                  value={form.lotCode}
                  onChange={(event) => handleLotChange(event.target.value)}
                  list="movement-lot-options"
                  placeholder="Ex.: PFM260327"
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                />
                <datalist id="movement-lot-options">
                  {lotCatalog.map((lot) => (
                    <option key={lot.code} value={buildLotOptionValue(lot)} />
                  ))}
                </datalist>
              </Field>

              <Field label="Tipo">
                <select
                  value={form.type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      type: event.target.value as MovementType,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                >
                  {MOVEMENT_TYPES.filter((item) => item.value !== "todos").map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Quantidade" error={errors.quantity}>
                <input
                  value={form.quantity}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, quantity: event.target.value.replace(/[^\d]/g, "") }))
                  }
                  inputMode="numeric"
                  placeholder="Ex.: 180"
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                />
              </Field>

              <Field label="Usuário responsável" error={errors.user}>
                <input
                  value={form.user}
                  onChange={(event) => setForm((current) => ({ ...current, user: event.target.value }))}
                  placeholder="Ex.: Equipe de Logística"
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                />
              </Field>

              {form.type === "transferencia" ? (
                <>
                  <Field label="Origem" error={errors.fromLocationId}>
                    <select
                      value={form.fromLocationId}
                      onChange={(event) => setForm((current) => ({ ...current, fromLocationId: event.target.value }))}
                      className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                    >
                      <option value="">Selecione</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name} · Ocupado {formatUnits(Math.max(0, getLocationUsedCapacity(location.id, movements.filter((item) => item.id !== editingId))))}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Destino" error={errors.toLocationId}>
                    <select
                      value={form.toLocationId}
                      onChange={(event) => setForm((current) => ({ ...current, toLocationId: event.target.value }))}
                      className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                    >
                      <option value="">Selecione</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name} · Disponível {formatUnits(Math.max(0, getLocationAvailableCapacity(location, movements.filter((item) => item.id !== editingId))))}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Localização" error={errors.locationId}>
                    <select
                      value={form.locationId}
                      onChange={(event) => setForm((current) => ({ ...current, locationId: event.target.value }))}
                      className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                    >
                      <option value="">Selecione</option>
                      {locations.map((location) => {
                        const baseline = movements.filter((item) => item.id !== editingId);
                        const helper =
                          form.type === "entrada"
                            ? `Disponível ${formatUnits(Math.max(0, getLocationAvailableCapacity(location, baseline)))}`
                            : `Ocupado ${formatUnits(Math.max(0, getLocationUsedCapacity(location.id, baseline)))}`;

                        return (
                          <option key={location.id} value={location.id}>
                            {location.name} · {helper}
                          </option>
                        );
                      })}
                    </select>
                  </Field>

                  <Field label="Status">
                    <select
                      value={form.status}
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as MovementStatus }))}
                      className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                    >
                      <option value="concluida">Concluída</option>
                      {canUpdateMovements ? <option value="cancelada">Cancelada</option> : null}
                    </select>
                  </Field>
                </>
              )}

              {form.type === "transferencia" ? (
                <>
                  <Field label="Status da transferência">
                    <select
                      value={form.transferStatus}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, transferStatus: event.target.value as TransferStatus }))
                      }
                      className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                    >
                      <option value="solicitada">Solicitada</option>
                      <option value="em_separacao">Em separação</option>
                      <option value="em_transito">Em trânsito</option>
                      <option value="recebida">Recebida</option>
                      {canUpdateMovements ? <option value="cancelada">Cancelada</option> : null}
                    </select>
                  </Field>

                  <Field label="Prioridade">
                    <select
                      value={form.priority}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, priority: event.target.value as TransferPriority }))
                      }
                      className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                    >
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                    </select>
                  </Field>
                </>
              ) : null}

              <div className="md:col-span-2">
                <Field label="Motivo" error={errors.reason}>
                  <input
                    value={form.reason}
                    onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                    placeholder={
                      form.type === "entrada"
                        ? "Ex.: Produção liberada para estoque"
                        : form.type === "saida"
                          ? "Ex.: Expedição para distribuidor"
                          : "Ex.: Rebalanceamento entre áreas"
                    }
                    className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                  />
                </Field>
              </div>

              <div className="md:col-span-2">
                <Field label="Observações">
                  <textarea
                    value={form.notes}
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    rows={3}
                    placeholder="Detalhes adicionais para auditoria interna"
                    className="w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:opacity-95"
              >
                {editingId ? "Salvar alterações" : "Registrar movimentação"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setDeleteTarget(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.28)]">
            <h2 className="text-lg font-semibold text-[var(--navy-900)]">Excluir movimentação?</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              A movimentação de <span className="font-semibold text-[var(--foreground)]">{deleteTarget.product}</span> será removida do histórico e as capacidades serão recalculadas.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-xl bg-[#dc2626] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

