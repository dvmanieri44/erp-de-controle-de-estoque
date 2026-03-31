"use client";

import { useMemo, useState } from "react";

type LocationType = "Depósito" | "Loja" | "Armazém";

type LocationItem = {
  id: string;
  name: string;
  type: LocationType;
  address: string;
  manager: string;
  capacity: string;
};

const INITIAL_LOCATIONS: LocationItem[] = [
  {
    id: "deposito-principal",
    name: "Depósito Principal",
    type: "Depósito",
    address: "Rua Central, 100 - São Paulo",
    manager: "Roberto Lima",
    capacity: "10.000 unidades",
  },
  {
    id: "loja-centro",
    name: "Loja Centro",
    type: "Loja",
    address: "Av. Paulista, 500 - São Paulo",
    manager: "Maria Costa",
    capacity: "2.000 unidades",
  },
] as const;

const LOCATION_TYPES: LocationType[] = ["Depósito", "Loja", "Armazém"];

type LocationFormState = {
  name: string;
  type: LocationType;
  address: string;
  manager: string;
  capacity: string;
};

const EMPTY_FORM: LocationFormState = {
  name: "",
  type: "Depósito",
  address: "",
  manager: "",
  capacity: "",
};

function createLocationId(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function LocationIcon() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path d="M5 9.5A2.5 2.5 0 0 1 7.5 7h9A2.5 2.5 0 0 1 19 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 16.5v-7Z" />
        <path d="M8 7V5.75A1.75 1.75 0 0 1 9.75 4h4.5A1.75 1.75 0 0 1 16 5.75V7" />
        <path d="M8.5 11.5h7" />
        <path d="M8.5 14.5h5" />
      </svg>
    </div>
  );
}

function ActionButton({
  children,
  tone = "default",
  onClick,
  label,
}: {
  children: React.ReactNode;
  tone?: "default" | "danger";
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition ${
        tone === "danger"
          ? "text-[#ef4444] hover:bg-[#fee2e2]"
          : "text-[var(--accent)] hover:bg-[var(--accent-soft)]"
      }`}
    >
      {children}
    </button>
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
        <LocationIcon />
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

      <div className="mt-4">
        <h3 className="text-lg font-semibold text-[var(--navy-900)]">{location.name}</h3>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{location.type}</p>
      </div>

      <div className="mt-4 space-y-1.5 text-sm text-[var(--muted-foreground)]">
        <p>{location.address}</p>
        <p>
          <span className="font-semibold text-[var(--foreground)]">Gerente:</span> {location.manager}
        </p>
        <p>
          <span className="font-semibold text-[var(--foreground)]">Capacidade:</span> {location.capacity}
        </p>
      </div>
    </article>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">{label}</span>
      {children}
    </label>
  );
}

export function LocationsScreen() {
  const [locations, setLocations] = useState<LocationItem[]>(INITIAL_LOCATIONS);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LocationFormState>(EMPTY_FORM);

  const filteredLocations = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return locations;
    }

    return locations.filter((location) =>
      [location.name, location.type, location.address, location.manager, location.capacity]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [locations, search]);

  const isEditing = editingId !== null;
  const isFormValid =
    form.name.trim() !== "" &&
    form.address.trim() !== "" &&
    form.manager.trim() !== "" &&
    form.capacity.trim() !== "";

  function openCreateModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  function openEditModal(location: LocationItem) {
    setEditingId(location.id);
    setForm({
      name: location.name,
      type: location.type,
      address: location.address,
      manager: location.manager,
      capacity: location.capacity,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleSubmit() {
    if (!isFormValid) {
      return;
    }

    if (isEditing) {
      setLocations((current) =>
        current.map((location) =>
          location.id === editingId
            ? {
                ...location,
                ...form,
              }
            : location,
        ),
      );
    } else {
      const baseId = createLocationId(form.name) || `localizacao-${Date.now()}`;
      const nextId = locations.some((location) => location.id === baseId) ? `${baseId}-${Date.now()}` : baseId;

      setLocations((current) => [
        {
          id: nextId,
          ...form,
        },
        ...current,
      ]);
    }

    closeModal();
  }

  function handleDelete(id: string) {
    setLocations((current) => current.filter((location) => location.id !== id));
  }

  return (
    <section className="relative min-h-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <header>
          <h1 className="text-[30px] font-semibold tracking-[-0.02em] text-[var(--navy-900)]">Localizações</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Gerencie depósitos, lojas e armazéns</p>
        </header>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:opacity-95"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nova Localização
        </button>
      </div>

      {searchOpen ? (
        <div className="mt-5 max-w-md">
          <Field label="Buscar localização">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome, gerente, endereço..."
              className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors"
            />
          </Field>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:max-w-5xl">
        {filteredLocations.map((location) => (
          <LocationCard
            key={location.id}
            location={location}
            onEdit={() => openEditModal(location)}
            onDelete={() => handleDelete(location.id)}
          />
        ))}
      </div>

      {filteredLocations.length === 0 ? (
        <div className="mt-6 max-w-5xl rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)] px-5 py-10 text-center">
          <p className="text-sm font-medium text-[var(--foreground)]">Nenhuma localização encontrada</p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Ajuste a busca ou cadastre uma nova localização.
          </p>
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--navy-900)]">
                  {isEditing ? "Editar localização" : "Nova localização"}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Preencha os dados da unidade para manter o estoque organizado.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--panel-border)] text-[var(--muted-foreground)] transition hover:bg-[var(--panel-soft)]"
                aria-label="Fechar formulário"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Nome da localização">
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors"
                />
              </Field>

              <Field label="Tipo">
                <select
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as LocationType }))}
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors"
                >
                  {LOCATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Gerente responsável">
                <input
                  value={form.manager}
                  onChange={(event) => setForm((current) => ({ ...current, manager: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors"
                />
              </Field>

              <Field label="Capacidade">
                <input
                  value={form.capacity}
                  onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))}
                  placeholder="Ex.: 5.000 unidades"
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors"
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Endereço">
                  <input
                    value={form.address}
                    onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors"
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
                disabled={!isFormValid}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${
                  isFormValid
                    ? "bg-[var(--accent)] shadow-[0_10px_24px_rgba(37,99,235,0.24)]"
                    : "cursor-not-allowed bg-slate-300"
                }`}
              >
                {isEditing ? "Salvar alterações" : "Cadastrar localização"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setSearchOpen((current) => !current)}
        className="fixed bottom-8 right-8 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_14px_30px_rgba(37,99,235,0.3)] transition hover:scale-[1.02]"
        aria-label="Pesquisar localizações"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4.2-4.2" />
        </svg>
      </button>
    </section>
  );
}
