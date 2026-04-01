"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type LocationType = "Dep\u00f3sito" | "Loja" | "Armaz\u00e9m";
type LocationStatus = "Ativa" | "Inativa" | "Em manuten\u00e7\u00e3o";

type LocationItem = {
  id: string;
  name: string;
  type: LocationType;
  address: string;
  manager: string;
  capacity: number;
  status: LocationStatus;
};

type ToastState = {
  id: number;
  message: string;
  tone: "success" | "error";
} | null;

type FormErrors = Partial<Record<keyof LocationFormState, string>>;

const STORAGE_KEY = "erp.locations";

const INITIAL_LOCATIONS: LocationItem[] = [
  {
    id: "deposito-principal",
    name: "Dep\u00f3sito Principal",
    type: "Dep\u00f3sito",
    address: "Rua Central, 100 - S\u00e3o Paulo",
    manager: "Roberto Lima",
    capacity: 10000,
    status: "Ativa",
  },
  {
    id: "loja-centro",
    name: "Loja Centro",
    type: "Loja",
    address: "Av. Paulista, 500 - S\u00e3o Paulo",
    manager: "Maria Costa",
    capacity: 2000,
    status: "Ativa",
  },
] as const;

const LOCATION_TYPES: Array<LocationType | "Todos"> = ["Todos", "Dep\u00f3sito", "Loja", "Armaz\u00e9m"];
const LOCATION_STATUS: LocationStatus[] = ["Ativa", "Inativa", "Em manuten\u00e7\u00e3o"];

type LocationFormState = {
  name: string;
  type: LocationType;
  address: string;
  manager: string;
  capacity: string;
  status: LocationStatus;
};

const EMPTY_FORM: LocationFormState = {
  name: "",
  type: "Dep\u00f3sito",
  address: "",
  manager: "",
  capacity: "",
  status: "Ativa",
};

function createLocationId(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function parseCapacity(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : NaN;
}

function formatCapacity(value: number) {
  return `${new Intl.NumberFormat("pt-BR").format(value)} unidades`;
}

function LocationIcon() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path d="M5 9.5A2.5 2.5 0 0 1 7.5 7h9A2.5 2.5 0 0 1 19 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 16.5v-7Z" />
        <path d="M8 7V5.75A1.75 1.75 0 0 1 9.75 4h4.5A1.75 1.75 0 0 1 16 5.75V7" />
        <path d="M8.5 11.5h7" />
        <path d="M8.5 14.5h5" />
      </svg>
    </div>
  );
}

function StatusBadge({ status }: { status: LocationStatus }) {
  const tone =
    status === "Ativa"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
      : status === "Em manuten\u00e7\u00e3o"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
        : "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}

function ActionButton({
  children,
  tone = "default",
  onClick,
  label,
}: {
  children: ReactNode;
  tone?: "default" | "danger";
  onClick: () => void;
  label: string;
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

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_6px_18px_var(--shadow-color)]">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--navy-900)]">{value}</p>
    </div>
  );
}

function LocationCard({
  location,
  onEdit,
  onDelete,
}: {
  location: LocationItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_6px_18px_var(--shadow-color)] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <LocationIcon />
          <div>
            <h3 className="text-lg font-semibold text-[var(--navy-900)]">{location.name}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
                {location.type}
              </span>
              <StatusBadge status={location.status} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <ActionButton onClick={onEdit} label={`Editar ${location.name}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path d="M4 20h4l10-10-4-4L4 16v4Z" />
              <path d="m12.5 7.5 4 4" />
            </svg>
          </ActionButton>
          <ActionButton onClick={onDelete} tone="danger" label={`Excluir ${location.name}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path d="M5 7h14" />
              <path d="M9 7V5h6v2" />
              <path d="M8 10v7M12 10v7M16 10v7" />
              <path d="M6 7l1 12h10l1-12" />
            </svg>
          </ActionButton>
        </div>
      </div>

      <div className="mt-5 space-y-2 text-sm text-[var(--muted-foreground)]">
        <p>{location.address}</p>
        <p>
          <span className="font-semibold text-[var(--foreground)]">Gerente:</span> {location.manager}
        </p>
        <p>
          <span className="font-semibold text-[var(--foreground)]">Capacidade:</span> {formatCapacity(location.capacity)}
        </p>
      </div>
    </article>
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
      className={`fixed right-4 top-4 z-50 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
        toast.tone === "success" ? "bg-emerald-600" : "bg-red-600"
      }`}
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  );
}

export function LocationsScreen() {
  const [locations, setLocations] = useState<LocationItem[]>(INITIAL_LOCATIONS);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<LocationType | "Todos">("Todos");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LocationFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<LocationItem | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const storedLocations = window.localStorage.getItem(STORAGE_KEY);

      if (!storedLocations) {
        return;
      }

      const parsed = JSON.parse(storedLocations) as LocationItem[];

      if (Array.isArray(parsed)) {
        setLocations(parsed);
      }
    } catch {
      setToast({
        id: Date.now(),
        message: "Nao foi possivel carregar as localizacoes salvas.",
        tone: "error",
      });
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
  }, [locations]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

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

  const filteredLocations = useMemo(() => {
    const query = normalizeText(search);

    return locations.filter((location) => {
      const matchesType = selectedType === "Todos" || location.type === selectedType;

      if (!matchesType) {
        return false;
      }

      if (!query) {
        return true;
      }

      return normalizeText(
        [location.name, location.type, location.address, location.manager, location.status, formatCapacity(location.capacity)].join(
          " ",
        ),
      ).includes(query);
    });
  }, [locations, search, selectedType]);

  const metrics = useMemo(() => {
    const deposits = locations.filter((location) => location.type === "Dep\u00f3sito").length;
    const stores = locations.filter((location) => location.type === "Loja").length;
    const totalCapacity = locations.reduce((sum, location) => sum + location.capacity, 0);

    return {
      total: locations.length,
      deposits,
      stores,
      totalCapacity,
    };
  }, [locations]);

  const isEditing = editingId !== null;

  function openCreateModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setIsModalOpen(true);
  }

  function openEditModal(location: LocationItem) {
    setEditingId(location.id);
    setForm({
      name: location.name,
      type: location.type,
      address: location.address,
      manager: location.manager,
      capacity: String(location.capacity),
      status: location.status,
    });
    setErrors({});
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function validateForm(values: LocationFormState) {
    const nextErrors: FormErrors = {};
    const normalizedName = normalizeText(values.name);
    const parsedCapacity = parseCapacity(values.capacity);

    if (!values.name.trim()) {
      nextErrors.name = "Informe o nome da localizacao.";
    } else if (
      locations.some((location) => normalizeText(location.name) === normalizedName && location.id !== editingId)
    ) {
      nextErrors.name = "Ja existe uma localizacao com esse nome.";
    }

    if (!values.address.trim()) {
      nextErrors.address = "Informe o endereco da localizacao.";
    }

    if (!values.manager.trim()) {
      nextErrors.manager = "Informe o gerente responsavel.";
    }

    if (!values.capacity.trim()) {
      nextErrors.capacity = "Informe a capacidade maxima.";
    } else if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0) {
      nextErrors.capacity = "Use apenas numeros e informe um valor maior que zero.";
    }

    return nextErrors;
  }

  function handleSubmit() {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const parsedCapacity = parseCapacity(form.capacity);

    if (isEditing) {
      setLocations((current) =>
        current.map((location) =>
          location.id === editingId
            ? {
                ...location,
                ...form,
                capacity: parsedCapacity,
              }
            : location,
        ),
      );

      setToast({
        id: Date.now(),
        message: "Localizacao atualizada com sucesso.",
        tone: "success",
      });
    } else {
      const baseId = createLocationId(form.name) || `localizacao-${Date.now()}`;
      const nextId = locations.some((location) => location.id === baseId) ? `${baseId}-${Date.now()}` : baseId;

      setLocations((current) => [
        {
          id: nextId,
          ...form,
          capacity: parsedCapacity,
        },
        ...current,
      ]);

      setToast({
        id: Date.now(),
        message: "Localizacao cadastrada com sucesso.",
        tone: "success",
      });
    }

    closeModal();
  }

  function confirmDelete(location: LocationItem) {
    setDeleteTarget(location);
  }

  function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setLocations((current) => current.filter((location) => location.id !== deleteTarget.id));
    setToast({
      id: Date.now(),
      message: "Localizacao excluida com sucesso.",
      tone: "success",
    });
    setDeleteTarget(null);
  }

  return (
    <section className="relative min-h-full pb-8">
      {toast ? <Toast toast={toast} /> : null}

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <header>
          <h1 className="text-[30px] font-semibold tracking-[-0.02em] text-[var(--navy-900)]">Localizacoes</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Gerencie depositos, lojas e armazens</p>
        </header>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nova localizacao
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total" value={String(metrics.total)} />
        <MetricCard title="Depositos" value={String(metrics.deposits)} />
        <MetricCard title="Lojas" value={String(metrics.stores)} />
        <MetricCard title="Capacidade total" value={formatCapacity(metrics.totalCapacity)} />
      </div>

      <div className="mt-6 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_6px_18px_var(--shadow-color)]">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <Field label="Buscar localizacao">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome, gerente, endereco ou status"
              className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
            />
          </Field>

          <Field label="Filtrar por tipo">
            <select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value as LocationType | "Todos")}
              className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
            >
              {LOCATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:max-w-5xl">
        {filteredLocations.map((location) => (
          <LocationCard
            key={location.id}
            location={location}
            onEdit={() => openEditModal(location)}
            onDelete={() => confirmDelete(location)}
          />
        ))}
      </div>

      {filteredLocations.length === 0 ? (
        <div className="mt-6 max-w-5xl rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)] px-5 py-10 text-center">
          <p className="text-sm font-medium text-[var(--foreground)]">Nenhuma localizacao encontrada</p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Ajuste a busca, altere o filtro ou cadastre uma nova localizacao.
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
          <div className="w-full max-w-2xl rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--navy-900)]">
                  {isEditing ? "Editar localizacao" : "Nova localizacao"}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Preencha os dados da unidade para manter o estoque organizado.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--panel-border)] text-[var(--muted-foreground)] transition hover:bg-[var(--panel-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                aria-label="Fechar formulario"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Nome da localizacao" error={errors.name}>
                <input
                  ref={firstFieldRef}
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ex.: Deposito Zona Norte"
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                />
              </Field>

              <Field label="Tipo">
                <select
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as LocationType }))}
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                >
                  {LOCATION_TYPES.filter((type) => type !== "Todos").map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Gerente responsavel" error={errors.manager}>
                <input
                  value={form.manager}
                  onChange={(event) => setForm((current) => ({ ...current, manager: event.target.value }))}
                  placeholder="Nome do responsavel"
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                />
              </Field>

              <Field label="Capacidade maxima" error={errors.capacity}>
                <input
                  value={form.capacity}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, capacity: event.target.value.replace(/[^\d]/g, "") }))
                  }
                  inputMode="numeric"
                  placeholder="Ex.: 5000"
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                />
              </Field>

              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value as LocationStatus }))
                  }
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                >
                  {LOCATION_STATUS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="md:col-span-2">
                <Field label="Endereco" error={errors.address}>
                  <input
                    value={form.address}
                    onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                    placeholder="Rua, numero, cidade"
                    className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
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
                {isEditing ? "Salvar alteracoes" : "Cadastrar localizacao"}
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
            <h2 className="text-lg font-semibold text-[var(--navy-900)]">Excluir localizacao?</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              A localizacao <span className="font-semibold text-[var(--foreground)]">{deleteTarget.name}</span> sera
              removida da lista.
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
