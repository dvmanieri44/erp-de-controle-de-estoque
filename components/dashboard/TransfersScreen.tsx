"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  DATE_RANGE_OPTIONS,
  INITIAL_LOCATIONS,
  TRANSFER_PRIORITY_OPTIONS,
  TRANSFER_STATUS_OPTIONS,
  buildTransferCode,
  formatDateTime,
  formatUnits,
  getLocationAvailableCapacity,
  getLocationUsedCapacity,
  getMovementStatusLabel,
  getTransferPriorityLabel,
  isMovementCancelled,
  loadLocations,
  loadMovements,
  matchesDateRange,
  normalizeText,
  saveMovements,
  type DateRangeFilter,
  type LocationItem,
  type MovementItem,
  type TransferPriority,
  type TransferStatus,
} from "@/lib/inventory";

type ToastState = {
  id: number;
  message: string;
  tone: "success" | "error";
  actionLabel?: string;
  onAction?: () => void;
} | null;

type TransferSort = "newest" | "oldest" | "quantity_desc" | "quantity_asc" | "priority";

type TransferFormState = {
  product: string;
  quantity: string;
  user: string;
  reason: string;
  fromLocationId: string;
  toLocationId: string;
  notes: string;
  priority: TransferPriority;
  transferStatus: TransferStatus;
};

type FormErrors = Partial<Record<keyof TransferFormState, string>>;

const EMPTY_FORM: TransferFormState = {
  product: "",
  quantity: "",
  user: "",
  reason: "",
  fromLocationId: "",
  toLocationId: "",
  notes: "",
  priority: "media",
  transferStatus: "solicitada",
};

function MetricCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="min-h-[132px] rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_6px_18px_var(--shadow-color)]">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{title}</p>
      <p className="mt-3 text-2xl font-semibold text-[var(--navy-900)]">{value}</p>
      {helper ? <p className="mt-2 max-w-[24ch] text-sm leading-5 text-[var(--muted-foreground)]">{helper}</p> : null}
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

function StatusBadge({ transfer }: { transfer: MovementItem }) {
  const label = getMovementStatusLabel(transfer);
  const tone =
    (transfer.transferStatus ?? "solicitada") === "cancelada"
      ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
      : (transfer.transferStatus ?? "solicitada") === "recebida"
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
        : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
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

function getPriorityWeight(priority: TransferPriority | undefined) {
  if (priority === "alta") return 3;
  if (priority === "media") return 2;
  return 1;
}

function buildTimeline(transfer: MovementItem) {
  const base = [
    { label: "Solicitada", active: true, date: transfer.createdAt },
    { label: "Em separação", active: ["em_separacao", "em_transito", "recebida"].includes(transfer.transferStatus ?? "solicitada") },
    { label: "Em trânsito", active: ["em_transito", "recebida"].includes(transfer.transferStatus ?? "solicitada") },
    { label: "Recebida", active: (transfer.transferStatus ?? "solicitada") === "recebida", date: transfer.receivedAt },
  ];

  if ((transfer.transferStatus ?? "solicitada") === "cancelada") {
    base.push({ label: "Cancelada", active: true, date: transfer.updatedAt });
  }

  return base;
}

export function TransfersScreen() {
  const [locations, setLocations] = useState<LocationItem[]>(INITIAL_LOCATIONS);
  const [movements, setMovements] = useState<MovementItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [originFilter, setOriginFilter] = useState("todos");
  const [destinationFilter, setDestinationFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState<TransferStatus | "todos">("todos");
  const [priorityFilter, setPriorityFilter] = useState<TransferPriority | "todos">("todos");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all");
  const [sortBy, setSortBy] = useState<TransferSort>("newest");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MovementItem | null>(null);
  const [form, setForm] = useState<TransferFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState<ToastState>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      setLocations(loadLocations());
      setMovements(loadMovements());
      setHasLoaded(true);
    } catch {
      setToast({
        id: Date.now(),
        message: "Não foi possível carregar as transferências salvas.",
        tone: "error",
      });
    }

    function syncInventory() {
      try {
        setLocations(loadLocations());
        setMovements(loadMovements());
        setHasLoaded(true);
      } catch {
        setToast({
          id: Date.now(),
          message: "Não foi possível sincronizar os dados.",
          tone: "error",
        });
      }
    }

    window.addEventListener("storage", syncInventory);
    return () => window.removeEventListener("storage", syncInventory);
  }, []);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    saveMovements(movements);
  }, [hasLoaded, movements]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    setVisibleCount(10);
  }, [search, originFilter, destinationFilter, statusFilter, priorityFilter, dateRange, sortBy]);

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

  const transfers = useMemo(
    () => movements.filter((movement) => movement.type === "transferencia"),
    [movements],
  );

  const filteredTransfers = useMemo(() => {
    const query = normalizeText(search);

    return transfers
      .filter((transfer) => matchesDateRange(transfer.createdAt, dateRange))
      .filter((transfer) => originFilter === "todos" || transfer.fromLocationId === originFilter)
      .filter((transfer) => destinationFilter === "todos" || transfer.toLocationId === destinationFilter)
      .filter((transfer) => statusFilter === "todos" || (transfer.transferStatus ?? "recebida") === statusFilter)
      .filter((transfer) => priorityFilter === "todos" || (transfer.priority ?? "media") === priorityFilter)
      .filter((transfer) => {
        if (!query) {
          return true;
        }

        return normalizeText(
          [
            transfer.product,
            transfer.reason,
            transfer.user,
            transfer.notes ?? "",
            transfer.code ?? "",
            findLocationName(locations, transfer.fromLocationId),
            findLocationName(locations, transfer.toLocationId),
            getMovementStatusLabel(transfer),
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

        if (sortBy === "priority") {
          return getPriorityWeight(right.priority) - getPriorityWeight(left.priority);
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
  }, [dateRange, destinationFilter, locations, originFilter, priorityFilter, search, sortBy, statusFilter, transfers]);

  const visibleTransfers = filteredTransfers.slice(0, visibleCount);

  const metrics = useMemo(() => {
    const totalQuantity = transfers.filter((transfer) => !isMovementCancelled(transfer)).reduce((sum, transfer) => sum + transfer.quantity, 0);
    const uniqueRoutes = new Set(transfers.map((transfer) => `${transfer.fromLocationId}:${transfer.toLocationId}`)).size;
    const today = new Date().toDateString();
    const todayCount = transfers.filter((transfer) => new Date(transfer.createdAt).toDateString() === today).length;
    const receivedCount = transfers.filter((transfer) => (transfer.transferStatus ?? "recebida") === "recebida").length;

    return {
      totalTransfers: transfers.length,
      totalQuantity,
      uniqueRoutes,
      todayCount,
      receivedCount,
    };
  }, [transfers]);

  function closeModal() {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function openModal(transfer?: MovementItem) {
    setIsModalOpen(true);
    setEditingId(transfer?.id ?? null);
    setForm({
      product: transfer?.product ?? "",
      quantity: transfer ? String(transfer.quantity) : "",
      user: transfer?.user ?? "",
      reason: transfer?.reason ?? "",
      fromLocationId: transfer?.fromLocationId ?? locations[0]?.id ?? "",
      toLocationId: transfer?.toLocationId ?? locations[1]?.id ?? locations[0]?.id ?? "",
      notes: transfer?.notes ?? "",
      priority: transfer?.priority ?? "media",
      transferStatus: transfer?.transferStatus ?? "solicitada",
    });
    setErrors({});
  }

  function validateForm(values: TransferFormState) {
    const nextErrors: FormErrors = {};
    const quantity = Number(values.quantity);
    const baseline = movements.filter((movement) => movement.id !== editingId);

    if (!values.product.trim()) {
      nextErrors.product = "Informe o produto transferido.";
    }

    if (!values.user.trim()) {
      nextErrors.user = "Informe o usuário responsável.";
    }

    if (!values.reason.trim()) {
      nextErrors.reason = "Informe o motivo da transferência.";
    }

    if (!values.quantity.trim()) {
      nextErrors.quantity = "Informe a quantidade.";
    } else if (!Number.isFinite(quantity) || quantity <= 0) {
      nextErrors.quantity = "Use um valor numérico maior que zero.";
    }

    if (!values.fromLocationId) {
      nextErrors.fromLocationId = "Selecione a origem.";
    }

    if (!values.toLocationId) {
      nextErrors.toLocationId = "Selecione o destino.";
    }

    if (values.fromLocationId && values.toLocationId && values.fromLocationId === values.toLocationId) {
      nextErrors.toLocationId = "Origem e destino precisam ser diferentes.";
    }

    if (Object.keys(nextErrors).length > 0 || values.transferStatus === "cancelada") {
      return nextErrors;
    }

    const fromLocation = locations.find((location) => location.id === values.fromLocationId);
    const toLocation = locations.find((location) => location.id === values.toLocationId);

    if (!fromLocation || !toLocation) {
      nextErrors.fromLocationId = "Selecione localizações válidas.";
      return nextErrors;
    }

    const used = Math.max(0, getLocationUsedCapacity(fromLocation.id, baseline));
    const available = Math.max(0, getLocationAvailableCapacity(toLocation, baseline));

    if (quantity > used) {
      nextErrors.quantity = `A origem possui apenas ${formatUnits(used)} ocupadas para transferência.`;
    } else if (quantity > available) {
      nextErrors.quantity = `O destino possui apenas ${formatUnits(available)} disponíveis.`;
    }

    return nextErrors;
  }

  function handleSubmit() {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const now = new Date().toISOString();
    const transfer: MovementItem = {
      id: editingId ?? `mov-${Date.now()}`,
      product: form.product.trim(),
      type: "transferencia",
      quantity: Number(form.quantity),
      reason: form.reason.trim(),
      user: form.user.trim(),
      createdAt: editingId ? movements.find((item) => item.id === editingId)?.createdAt ?? now : now,
      updatedAt: editingId ? now : undefined,
      fromLocationId: form.fromLocationId,
      toLocationId: form.toLocationId,
      notes: form.notes.trim() || undefined,
      priority: form.priority,
      transferStatus: form.transferStatus,
      code: movements.find((item) => item.id === editingId)?.code ?? buildTransferCode(new Date()),
      receivedAt:
        form.transferStatus === "recebida"
          ? movements.find((item) => item.id === editingId)?.receivedAt ?? now
          : undefined,
    };

    setMovements((current) =>
      editingId ? current.map((item) => (item.id === editingId ? transfer : item)) : [transfer, ...current],
    );
    setToast({
      id: Date.now(),
      message: editingId ? "Transferência atualizada com sucesso." : "Transferência registrada com sucesso.",
      tone: "success",
    });
    closeModal();
  }

  function handleDuplicate(transfer: MovementItem) {
    setIsModalOpen(true);
    setEditingId(null);
    setForm({
      product: transfer.product,
      quantity: String(transfer.quantity),
      user: transfer.user,
      reason: transfer.reason,
      fromLocationId: transfer.fromLocationId ?? locations[0]?.id ?? "",
      toLocationId: transfer.toLocationId ?? locations[1]?.id ?? locations[0]?.id ?? "",
      notes: transfer.notes ?? "",
      priority: transfer.priority ?? "media",
      transferStatus: transfer.transferStatus ?? "solicitada",
    });
    setErrors({});
  }

  function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    if ((deleteTarget.transferStatus ?? "recebida") === "recebida") {
      setToast({
        id: Date.now(),
        message: "Transferências recebidas não podem ser excluídas. Cancele ou edite o status, se necessário.",
        tone: "error",
      });
      setDeleteTarget(null);
      return;
    }

    const removed = deleteTarget;

    setMovements((current) => current.filter((movement) => movement.id !== removed.id));
    setToast({
      id: Date.now(),
      message: "Transferência excluída com sucesso.",
      tone: "success",
      actionLabel: "Desfazer",
      onAction: () => {
        setMovements((current) => [removed, ...current]);
        setToast({
          id: Date.now(),
          message: "Transferência restaurada.",
          tone: "success",
        });
      },
    });
    setDeleteTarget(null);
  }

  function handleAdvanceStatus(transfer: MovementItem) {
    const currentStatus = transfer.transferStatus ?? "solicitada";
    const nextStatus =
      currentStatus === "solicitada"
        ? "em_separacao"
        : currentStatus === "em_separacao"
          ? "em_transito"
          : currentStatus === "em_transito"
            ? "recebida"
            : currentStatus;

    if (nextStatus === currentStatus || currentStatus === "cancelada") {
      return;
    }

    const now = new Date().toISOString();
    setMovements((current) =>
      current.map((item) =>
        item.id === transfer.id
          ? {
              ...item,
              transferStatus: nextStatus,
              updatedAt: now,
              receivedAt: nextStatus === "recebida" ? item.receivedAt ?? now : item.receivedAt,
            }
          : item,
      ),
    );
  }

  function handleCancelTransfer(transfer: MovementItem) {
    setMovements((current) =>
      current.map((item) =>
        item.id === transfer.id
          ? {
              ...item,
              transferStatus: "cancelada",
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  }

  function handleExport() {
    exportCsv("transferencias.csv", [
      ["Codigo", "Produto", "Origem", "Destino", "Quantidade", "Status", "Prioridade", "Usuario", "Data"],
      ...filteredTransfers.map((transfer) => [
        transfer.code ?? "",
        transfer.product,
        findLocationName(locations, transfer.fromLocationId),
        findLocationName(locations, transfer.toLocationId),
        String(transfer.quantity),
        getMovementStatusLabel(transfer),
        getTransferPriorityLabel(transfer.priority),
        transfer.user,
        formatDateTime(transfer.createdAt),
      ]),
    ]);
  }

  const canCreateTransfer = locations.length >= 2;

  return (
    <section className="relative space-y-6 pb-8">
      {toast ? <Toast toast={toast} /> : null}

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <header>
          <h1 className="text-[30px] font-semibold tracking-[-0.02em] text-[var(--navy-900)]">Transferências</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
            Fluxo operacional entre localizações com status, prioridade, timeline e impacto compartilhado com movimentações
          </p>
        </header>

        <div className="flex flex-wrap gap-3 xl:justify-end">
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
            disabled={!canCreateTransfer}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
              canCreateTransfer ? "bg-[var(--accent)] hover:opacity-95" : "cursor-not-allowed bg-slate-300 shadow-none"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nova transferência
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-5">
        <MetricCard title="Transferências" value={String(metrics.totalTransfers)} helper="Total histórico registrado" />
        <MetricCard title="Itens transferidos" value={formatUnits(metrics.totalQuantity)} helper="Somente não canceladas" />
        <MetricCard title="Rotas ativas" value={String(metrics.uniqueRoutes)} helper="Origem e destino distintos" />
        <MetricCard title="Hoje" value={String(metrics.todayCount)} helper="Registros do dia" />
        <MetricCard title="Recebidas" value={String(metrics.receivedCount)} helper="Concluídas com recebimento" />
      </div>

      <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_6px_18px_var(--shadow-color)]">
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <Field label="Buscar transferência">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Produto, usuário, código, motivo, origem ou destino"
                className="h-12 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
              />
            </Field>
          </div>

          <div className="sm:grid sm:grid-cols-2 sm:gap-4 xl:col-span-7 xl:grid-cols-4">
            <Field label="Período">
              <select
                value={dateRange}
                onChange={(event) => setDateRange(event.target.value as DateRangeFilter)}
                className="h-12 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
              >
                {DATE_RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Origem">
              <select
                value={originFilter}
                onChange={(event) => setOriginFilter(event.target.value)}
                className="h-12 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
              >
                <option value="todos">Todas</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Destino">
              <select
                value={destinationFilter}
                onChange={(event) => setDestinationFilter(event.target.value)}
                className="h-12 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
              >
                <option value="todos">Todos</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as TransferStatus | "todos")}
                className="h-12 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
              >
                <option value="todos">Todos</option>
                {TRANSFER_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px_240px]">
          <div className="hidden lg:block" />

          <Field label="Prioridade">
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as TransferPriority | "todos")}
              className="h-12 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
            >
              <option value="todos">Todas</option>
              {TRANSFER_PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Ordenar por">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as TransferSort)}
              className="h-12 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
            >
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigas</option>
              <option value="quantity_desc">Maior quantidade</option>
              <option value="quantity_asc">Menor quantidade</option>
              <option value="priority">Maior prioridade</option>
            </select>
          </Field>
        </div>
      </div>

      {!canCreateTransfer ? (
        <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)] px-5 py-10 text-center">
          <p className="text-sm font-medium text-[var(--foreground)]">Cadastre pelo menos duas localizações antes de criar transferências.</p>
        </div>
      ) : null}

      <div className="space-y-4">
        {visibleTransfers.map((transfer) => (
          <article key={transfer.id} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] shadow-[0_6px_18px_var(--shadow-color)]">
            <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-[var(--navy-900)]">{transfer.product}</h3>
                  <StatusBadge transfer={transfer} />
                  <span className="inline-flex rounded-full bg-[var(--panel-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
                    Prioridade {getTransferPriorityLabel(transfer.priority)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{transfer.reason}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
                  <span>{transfer.code}</span>
                  <span>{formatDateTime(transfer.createdAt)}</span>
                  <span>Por {transfer.user}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(transfer.transferStatus ?? "solicitada") !== "recebida" && (transfer.transferStatus ?? "solicitada") !== "cancelada" ? (
                  <button
                    type="button"
                    onClick={() => handleAdvanceStatus(transfer)}
                    className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]"
                  >
                    Avançar status
                  </button>
                ) : null}
                {(transfer.transferStatus ?? "solicitada") !== "cancelada" && (transfer.transferStatus ?? "solicitada") !== "recebida" ? (
                  <button
                    type="button"
                    onClick={() => handleCancelTransfer(transfer)}
                    className="rounded-xl border border-[#fecaca] px-3 py-2 text-sm font-semibold text-[#dc2626] transition hover:bg-[#fff1f2]"
                  >
                    Cancelar
                  </button>
                ) : null}
                <ActionButton label={`Ver detalhes de ${transfer.product}`} onClick={() => setExpandedIds((current) => current.includes(transfer.id) ? current.filter((id) => id !== transfer.id) : [...current, transfer.id])}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                    <path d={expandedIds.includes(transfer.id) ? "M6 15l6-6 6 6" : "m6 9 6 6 6-6"} />
                  </svg>
                </ActionButton>
                <ActionButton label={`Editar transferência de ${transfer.product}`} onClick={() => openModal(transfer)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                    <path d="M4 20h4l10-10-4-4L4 16v4Z" />
                    <path d="m12.5 7.5 4 4" />
                  </svg>
                </ActionButton>
                <ActionButton label={`Duplicar transferência de ${transfer.product}`} onClick={() => handleDuplicate(transfer)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                    <rect x="9" y="9" width="10" height="10" rx="2" />
                    <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                  </svg>
                </ActionButton>
                <ActionButton label={`Excluir transferência de ${transfer.product}`} onClick={() => setDeleteTarget(transfer)} tone="danger">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                    <path d="M5 7h14" />
                    <path d="M9 7V5h6v2" />
                    <path d="M8 10v7M12 10v7M16 10v7" />
                    <path d="M6 7l1 12h10l1-12" />
                  </svg>
                </ActionButton>
              </div>
            </div>

            <div className="border-t border-[var(--panel-border)] px-4 py-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-[var(--panel-soft)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Origem</p>
                  <p className="mt-2 font-semibold text-[var(--foreground)]">{findLocationName(locations, transfer.fromLocationId)}</p>
                  {transfer.fromLocationId ? <p className="mt-1 text-sm text-[var(--muted-foreground)]">Ocupado: {formatUnits(Math.max(0, getLocationUsedCapacity(transfer.fromLocationId, movements)))}</p> : null}
                </div>
                <div className="rounded-2xl bg-[var(--panel-soft)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Destino</p>
                  <p className="mt-2 font-semibold text-[var(--foreground)]">{findLocationName(locations, transfer.toLocationId)}</p>
                  {transfer.toLocationId ? (
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      Disponível: {formatUnits(Math.max(0, getLocationAvailableCapacity(locations.find((location) => location.id === transfer.toLocationId) ?? locations[0], movements)))}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-2xl bg-[var(--panel-soft)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Quantidade</p>
                  <p className="mt-2 font-semibold text-[var(--foreground)]">{formatUnits(transfer.quantity)}</p>
                  {transfer.receivedAt ? <p className="mt-1 text-sm text-[var(--muted-foreground)]">Recebida em {formatDateTime(transfer.receivedAt)}</p> : null}
                </div>
              </div>

              {expandedIds.includes(transfer.id) ? (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl bg-[var(--panel-soft)] p-4">
                    <p className="text-sm font-semibold text-[var(--foreground)]">Linha do tempo</p>
                    <div className="mt-3 space-y-3">
                      {buildTimeline(transfer).map((step) => (
                        <div key={step.label} className="flex items-start gap-3">
                          <div className={`mt-1 h-2.5 w-2.5 rounded-full ${step.active ? "bg-[var(--accent)]" : "bg-slate-300"}`} />
                          <div>
                            <p className={`text-sm font-medium ${step.active ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>{step.label}</p>
                            {step.date ? <p className="text-xs text-[var(--muted-foreground)]">{formatDateTime(step.date)}</p> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[var(--panel-soft)] p-4">
                    <p className="text-sm font-semibold text-[var(--foreground)]">Auditoria</p>
                    <p className="mt-3 text-sm text-[var(--muted-foreground)]">Status atual: {getMovementStatusLabel(transfer)}</p>
                    <p className="text-sm text-[var(--muted-foreground)]">Prioridade: {getTransferPriorityLabel(transfer.priority)}</p>
                    {transfer.notes ? <p className="mt-2 text-sm text-[var(--muted-foreground)]">Observações: {transfer.notes}</p> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {filteredTransfers.length > visibleCount ? (
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

      {filteredTransfers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)] px-5 py-10 text-center">
          <p className="text-sm font-medium text-[var(--foreground)]">Nenhuma transferência encontrada</p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Ajuste a busca, altere os filtros ou registre uma nova transferência.
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
                  {editingId ? "Editar transferência" : "Nova transferência"}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Mova estoque entre localizações usando a mesma base do histórico geral de movimentações.
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
                  onChange={(event) => setForm((current) => ({ ...current, product: event.target.value }))}
                  placeholder="Ex.: Teclado Mecânico Keychron K2"
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                />
              </Field>

              <Field label="Quantidade" error={errors.quantity}>
                <input
                  value={form.quantity}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, quantity: event.target.value.replace(/[^\d]/g, "") }))
                  }
                  inputMode="numeric"
                  placeholder="Ex.: 15"
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                />
              </Field>

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

              <Field label="Usuário responsável" error={errors.user}>
                <input
                  value={form.user}
                  onChange={(event) => setForm((current) => ({ ...current, user: event.target.value }))}
                  placeholder="Ex.: João Silva"
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                />
              </Field>

              <Field label="Prioridade">
                <select
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as TransferPriority }))}
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                >
                  {TRANSFER_PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Status">
                <select
                  value={form.transferStatus}
                  onChange={(event) => setForm((current) => ({ ...current, transferStatus: event.target.value as TransferStatus }))}
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                >
                  {TRANSFER_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="md:col-span-2">
                <Field label="Motivo" error={errors.reason}>
                  <input
                    value={form.reason}
                    onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                    placeholder="Ex.: Reposição da loja centro"
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
                    placeholder="Detalhes adicionais para a transferência"
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
                {editingId ? "Salvar alterações" : "Registrar transferência"}
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
            <h2 className="text-lg font-semibold text-[var(--navy-900)]">Excluir transferência?</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              A transferência de <span className="font-semibold text-[var(--foreground)]">{deleteTarget.product}</span> será removida do histórico.
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
