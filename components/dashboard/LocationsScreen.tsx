"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { formatMessage } from "@/lib/i18n";
import {
  INITIAL_LOCATIONS,
  createLocationId,
  formatUnits,
  getLocationAvailableCapacity,
  getLocationStatusLabel,
  getLocationStatusOptions,
  getLocationTypeLabel,
  getLocationTypeOptions,
  getLocationUsedCapacity,
  loadLocations,
  loadMovements,
  normalizeText,
  parseCapacity,
  saveLocations,
  type LocationItem,
  type LocationStatus,
  type LocationType,
  type MovementItem,
} from "@/lib/inventory";

type ToastState = {
  id: number;
  message: string;
  tone: "success" | "error";
} | null;

type LocationFormState = {
  name: string;
  type: LocationType;
  address: string;
  manager: string;
  capacity: string;
  status: LocationStatus;
};

type FormErrors = Partial<Record<keyof LocationFormState, string>>;

const EMPTY_FORM: LocationFormState = {
  name: "",
  type: "Fábrica",
  address: "",
  manager: "",
  capacity: "",
  status: "Ativa",
};

const COPY = {
  "pt-BR": {
    usedCapacityRate: "{rate}% da capacidade utilizada",
    editLocationAria: "Editar {name}",
    deleteLocationAria: "Excluir {name}",
    manager: "Gerente",
    totalCapacity: "Capacidade total",
    occupied: "Ocupado",
    available: "Disponível",
    loadSavedDataError: "Não foi possível carregar os dados salvos.",
    syncDataError: "Não foi possível sincronizar os dados.",
    nameRequired: "Informe o nome da localização.",
    duplicatedName: "Já existe uma localização com esse nome.",
    addressRequired: "Informe o endereço da localização.",
    managerRequired: "Informe o gerente responsável.",
    capacityRequired: "Informe a capacidade máxima.",
    capacityInvalid: "Use apenas números e informe um valor maior que zero.",
    capacityLessThanUsed: "A capacidade total não pode ser menor que o volume já ocupado.",
    locationUpdated: "Localização atualizada com sucesso.",
    locationCreated: "Localização cadastrada com sucesso.",
    locationHasHistory: "Essa localização já possui movimentações registradas e não pode ser excluída.",
    locationDeleted: "Localização excluída com sucesso.",
    title: "Localizações",
    description: "Gerencie fábrica, centros de distribuição, expedição e áreas de qualidade",
    newLocation: "Nova localização",
    total: "Total",
    factories: "Fábricas",
    distributionCenters: "CDs",
    searchLabel: "Buscar localização",
    searchPlaceholder: "Nome, gerente, endereço ou status",
    filterLabel: "Filtrar por tipo",
    noResultsTitle: "Nenhuma localização encontrada",
    noResultsDescription: "Ajuste a busca, altere o filtro ou cadastre uma nova localização.",
    editLocationTitle: "Editar localização",
    newLocationTitle: "Nova localização",
    modalDescription: "Cadastre os dados da área e defina a capacidade máxima disponível para armazenagem.",
    closeForm: "Fechar formulário",
    nameLabel: "Nome da localização",
    namePlaceholder: "Ex.: CD Sudeste ou Expedição Dourado",
    typeLabel: "Tipo",
    managerLabel: "Gerente responsável",
    managerPlaceholder: "Nome do líder da área",
    capacityLabel: "Capacidade máxima",
    capacityPlaceholder: "Ex.: 5000",
    statusLabel: "Status",
    addressLabel: "Endereço",
    addressPlaceholder: "Unidade, setor ou endereço logístico",
    cancel: "Cancelar",
    saveChanges: "Salvar alterações",
    registerLocation: "Cadastrar localização",
    deleteTitle: "Excluir localização?",
    deleteDescription: "A localização {name} será removida da lista.",
    delete: "Excluir",
  },
  "en-US": {
    usedCapacityRate: "{rate}% of capacity in use",
    editLocationAria: "Edit {name}",
    deleteLocationAria: "Delete {name}",
    manager: "Manager",
    totalCapacity: "Total capacity",
    occupied: "Used",
    available: "Available",
    loadSavedDataError: "Could not load the saved data.",
    syncDataError: "Could not sync the data.",
    nameRequired: "Enter the location name.",
    duplicatedName: "A location with this name already exists.",
    addressRequired: "Enter the location address.",
    managerRequired: "Enter the responsible manager.",
    capacityRequired: "Enter the maximum capacity.",
    capacityInvalid: "Use numbers only and enter a value greater than zero.",
    capacityLessThanUsed: "Total capacity cannot be lower than the volume already in use.",
    locationUpdated: "Location updated successfully.",
    locationCreated: "Location created successfully.",
    locationHasHistory: "This location already has recorded movements and cannot be deleted.",
    locationDeleted: "Location deleted successfully.",
    title: "Locations",
    description: "Manage factory, distribution centers, shipping and quality areas",
    newLocation: "New location",
    total: "Total",
    factories: "Factories",
    distributionCenters: "DCs",
    searchLabel: "Search location",
    searchPlaceholder: "Name, manager, address or status",
    filterLabel: "Filter by type",
    noResultsTitle: "No locations found",
    noResultsDescription: "Adjust the search, change the filter or create a new location.",
    editLocationTitle: "Edit location",
    newLocationTitle: "New location",
    modalDescription: "Register the area data and define the maximum storage capacity available.",
    closeForm: "Close form",
    nameLabel: "Location name",
    namePlaceholder: "Ex.: Southeast DC or Dourado Shipping",
    typeLabel: "Type",
    managerLabel: "Responsible manager",
    managerPlaceholder: "Area lead name",
    capacityLabel: "Maximum capacity",
    capacityPlaceholder: "Ex.: 5000",
    statusLabel: "Status",
    addressLabel: "Address",
    addressPlaceholder: "Unit, sector or logistics address",
    cancel: "Cancel",
    saveChanges: "Save changes",
    registerLocation: "Create location",
    deleteTitle: "Delete location?",
    deleteDescription: "The location {name} will be removed from the list.",
    delete: "Delete",
  },
  "es-ES": {
    usedCapacityRate: "{rate}% de la capacidad utilizada",
    editLocationAria: "Editar {name}",
    deleteLocationAria: "Eliminar {name}",
    manager: "Responsable",
    totalCapacity: "Capacidad total",
    occupied: "Ocupado",
    available: "Disponible",
    loadSavedDataError: "No se pudieron cargar los datos guardados.",
    syncDataError: "No se pudieron sincronizar los datos.",
    nameRequired: "Informa el nombre de la ubicación.",
    duplicatedName: "Ya existe una ubicación con ese nombre.",
    addressRequired: "Informa la dirección de la ubicación.",
    managerRequired: "Informa el responsable del área.",
    capacityRequired: "Informa la capacidad máxima.",
    capacityInvalid: "Usa solo números e informa un valor mayor que cero.",
    capacityLessThanUsed: "La capacidad total no puede ser menor que el volumen ya ocupado.",
    locationUpdated: "Ubicación actualizada con éxito.",
    locationCreated: "Ubicación creada con éxito.",
    locationHasHistory: "Esta ubicación ya tiene movimientos registrados y no se puede eliminar.",
    locationDeleted: "Ubicación eliminada con éxito.",
    title: "Ubicaciones",
    description: "Gestiona fábrica, centros de distribución, expedición y áreas de calidad",
    newLocation: "Nueva ubicación",
    total: "Total",
    factories: "Fábricas",
    distributionCenters: "CDs",
    searchLabel: "Buscar ubicación",
    searchPlaceholder: "Nombre, responsable, dirección o estado",
    filterLabel: "Filtrar por tipo",
    noResultsTitle: "No se encontró ninguna ubicación",
    noResultsDescription: "Ajusta la búsqueda, cambia el filtro o crea una nueva ubicación.",
    editLocationTitle: "Editar ubicación",
    newLocationTitle: "Nueva ubicación",
    modalDescription: "Registra los datos del área y define la capacidad máxima disponible para almacenamiento.",
    closeForm: "Cerrar formulario",
    nameLabel: "Nombre de la ubicación",
    namePlaceholder: "Ej.: CD Sudeste o Expedición Dourado",
    typeLabel: "Tipo",
    managerLabel: "Responsable del área",
    managerPlaceholder: "Nombre del líder del área",
    capacityLabel: "Capacidad máxima",
    capacityPlaceholder: "Ej.: 5000",
    statusLabel: "Estado",
    addressLabel: "Dirección",
    addressPlaceholder: "Unidad, sector o dirección logística",
    cancel: "Cancelar",
    saveChanges: "Guardar cambios",
    registerLocation: "Crear ubicación",
    deleteTitle: "¿Eliminar ubicación?",
    deleteDescription: "La ubicación {name} se eliminará de la lista.",
    delete: "Eliminar",
  },
} as const;

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

function StatusBadge({
  status,
  locale,
}: {
  status: LocationStatus;
  locale: keyof typeof COPY;
}) {
  const tone =
    status === "Ativa"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
      : status === "Em manutenção"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
        : "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {getLocationStatusLabel(status, locale)}
    </span>
  );
}

function ProgressBar({
  value,
  max,
  subtitle,
}: {
  value: number;
  max: number;
  subtitle: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const tone = percent >= 90 ? "bg-red-500" : percent >= 70 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div>
      <div className="h-2 rounded-full bg-[var(--panel-soft)]">
        <div className={`h-2 rounded-full transition-all ${tone}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        {formatMessage(subtitle, { rate: percent.toFixed(0) })}
      </p>
    </div>
  );
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
  movements,
  locale,
  copy,
  onEdit,
  onDelete,
}: {
  location: LocationItem;
  movements: MovementItem[];
  locale: keyof typeof COPY;
  copy: (typeof COPY)[keyof typeof COPY];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const used = Math.max(0, getLocationUsedCapacity(location.id, movements));
  const available = Math.max(0, getLocationAvailableCapacity(location, movements));

  return (
    <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_6px_18px_var(--shadow-color)] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <LocationIcon />
          <div>
            <h3 className="text-lg font-semibold text-[var(--navy-900)]">{location.name}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
                {getLocationTypeLabel(location.type, locale)}
              </span>
              <StatusBadge status={location.status} locale={locale} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <ActionButton onClick={onEdit} label={formatMessage(copy.editLocationAria, { name: location.name })}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path d="M4 20h4l10-10-4-4L4 16v4Z" />
              <path d="m12.5 7.5 4 4" />
            </svg>
          </ActionButton>
          <ActionButton onClick={onDelete} tone="danger" label={formatMessage(copy.deleteLocationAria, { name: location.name })}>
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
          <span className="font-semibold text-[var(--foreground)]">{copy.manager}:</span> {location.manager}
        </p>
        <p>
          <span className="font-semibold text-[var(--foreground)]">{copy.totalCapacity}:</span> {formatUnits(location.capacityTotal, locale)}
        </p>
        <p>
          <span className="font-semibold text-[var(--foreground)]">{copy.occupied}:</span> {formatUnits(used, locale)}
        </p>
        <p>
          <span className="font-semibold text-[var(--foreground)]">{copy.available}:</span> {formatUnits(available, locale)}
        </p>
      </div>

      <div className="mt-4">
        <ProgressBar value={used} max={location.capacityTotal} subtitle={copy.usedCapacityRate} />
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
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [locations, setLocations] = useState<LocationItem[]>(INITIAL_LOCATIONS);
  const [movements, setMovements] = useState<MovementItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<LocationType | "Todos">("Todos");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LocationFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<LocationItem | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const locationTypeOptions = useMemo(() => getLocationTypeOptions(locale), [locale]);
  const locationStatusOptions = useMemo(() => getLocationStatusOptions(locale), [locale]);
  const deleteDescriptionParts = useMemo(() => copy.deleteDescription.split("{name}"), [copy.deleteDescription]);

  useEffect(() => {
    try {
      setLocations(loadLocations());
      setMovements(loadMovements());
      setHasLoaded(true);
    } catch {
      setToast({
        id: Date.now(),
        message: copy.loadSavedDataError,
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
          message: copy.syncDataError,
          tone: "error",
        });
      }
    }

    window.addEventListener("storage", syncInventory);
    return () => window.removeEventListener("storage", syncInventory);
  }, [copy.loadSavedDataError, copy.syncDataError]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    saveLocations(locations);
  }, [hasLoaded, locations]);

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
        [
          location.name,
          location.type,
          getLocationTypeLabel(location.type, locale),
          location.address,
          location.manager,
          location.status,
          getLocationStatusLabel(location.status, locale),
          formatUnits(location.capacityTotal, locale),
          formatUnits(getLocationUsedCapacity(location.id, movements), locale),
        ].join(" "),
      ).includes(query);
    });
  }, [locale, locations, movements, search, selectedType]);

  const metrics = useMemo(() => {
    const factories = locations.filter((location) => location.type === "Fábrica").length;
    const distributionCenters = locations.filter((location) => location.type === "Centro de Distribuição").length;
    const totalCapacity = locations.reduce((sum, location) => sum + location.capacityTotal, 0);
    const totalUsed = locations.reduce((sum, location) => sum + Math.max(0, getLocationUsedCapacity(location.id, movements)), 0);

    return {
      total: locations.length,
      factories,
      distributionCenters,
      totalCapacity,
      totalAvailable: Math.max(0, totalCapacity - totalUsed),
    };
  }, [locations, movements]);

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
      capacity: String(location.capacityTotal),
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
    const currentUsed = editingId
      ? Math.max(0, getLocationUsedCapacity(editingId, movements))
      : 0;

    if (!values.name.trim()) {
      nextErrors.name = copy.nameRequired;
    } else if (
      locations.some((location) => normalizeText(location.name) === normalizedName && location.id !== editingId)
    ) {
      nextErrors.name = copy.duplicatedName;
    }

    if (!values.address.trim()) {
      nextErrors.address = copy.addressRequired;
    }

    if (!values.manager.trim()) {
      nextErrors.manager = copy.managerRequired;
    }

    if (!values.capacity.trim()) {
      nextErrors.capacity = copy.capacityRequired;
    } else if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0) {
      nextErrors.capacity = copy.capacityInvalid;
    } else if (parsedCapacity < currentUsed) {
      nextErrors.capacity = copy.capacityLessThanUsed;
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
                name: form.name.trim(),
                type: form.type,
                address: form.address.trim(),
                manager: form.manager.trim(),
                capacityTotal: parsedCapacity,
                status: form.status,
              }
            : location,
        ),
      );

      setToast({
        id: Date.now(),
        message: copy.locationUpdated,
        tone: "success",
      });
    } else {
      const baseId = createLocationId(form.name) || `localizacao-${Date.now()}`;
      const nextId = locations.some((location) => location.id === baseId) ? `${baseId}-${Date.now()}` : baseId;

      setLocations((current) => [
        {
          id: nextId,
          name: form.name.trim(),
          type: form.type,
          address: form.address.trim(),
          manager: form.manager.trim(),
          capacityTotal: parsedCapacity,
          status: form.status,
        },
        ...current,
      ]);

      setToast({
        id: Date.now(),
        message: copy.locationCreated,
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

    const hasHistory = movements.some(
      (movement) =>
        movement.locationId === deleteTarget.id ||
        movement.fromLocationId === deleteTarget.id ||
        movement.toLocationId === deleteTarget.id,
    );

    if (hasHistory) {
      setToast({
        id: Date.now(),
        message: copy.locationHasHistory,
        tone: "error",
      });
      setDeleteTarget(null);
      return;
    }

    setLocations((current) => current.filter((location) => location.id !== deleteTarget.id));
    setToast({
      id: Date.now(),
      message: copy.locationDeleted,
      tone: "success",
    });
    setDeleteTarget(null);
  }

  return (
    <section className="relative min-h-full pb-8">
      {toast ? <Toast toast={toast} /> : null}

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <header>
          <h1 className="text-[30px] font-semibold tracking-[-0.02em] text-[var(--navy-900)]">{copy.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{copy.description}</p>
        </header>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {copy.newLocation}
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title={copy.total} value={String(metrics.total)} />
        <MetricCard title={copy.factories} value={String(metrics.factories)} />
        <MetricCard title={copy.distributionCenters} value={String(metrics.distributionCenters)} />
        <MetricCard title={copy.totalCapacity} value={formatUnits(metrics.totalCapacity, locale)} />
        <MetricCard title={copy.available} value={formatUnits(metrics.totalAvailable, locale)} />
      </div>

      <div className="mt-6 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_6px_18px_var(--shadow-color)]">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <Field label={copy.searchLabel}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={copy.searchPlaceholder}
              className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
            />
          </Field>

          <Field label={copy.filterLabel}>
            <select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value as LocationType | "Todos")}
              className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
            >
              {locationTypeOptions.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:max-w-6xl">
        {filteredLocations.map((location) => (
          <LocationCard
            key={location.id}
            location={location}
            movements={movements}
            locale={locale}
            copy={copy}
            onEdit={() => openEditModal(location)}
            onDelete={() => confirmDelete(location)}
          />
        ))}
      </div>

      {filteredLocations.length === 0 ? (
        <div className="mt-6 max-w-5xl rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)] px-5 py-10 text-center">
          <p className="text-sm font-medium text-[var(--foreground)]">{copy.noResultsTitle}</p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">{copy.noResultsDescription}</p>
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
                  {isEditing ? copy.editLocationTitle : copy.newLocationTitle}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{copy.modalDescription}</p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--panel-border)] text-[var(--muted-foreground)] transition hover:bg-[var(--panel-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                aria-label={copy.closeForm}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label={copy.nameLabel} error={errors.name}>
                <input
                  ref={firstFieldRef}
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder={copy.namePlaceholder}
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                />
              </Field>

              <Field label={copy.typeLabel}>
                <select
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as LocationType }))}
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                >
                  {locationTypeOptions
                    .filter((type) => type.value !== "Todos")
                    .map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={copy.managerLabel} error={errors.manager}>
                <input
                  value={form.manager}
                  onChange={(event) => setForm((current) => ({ ...current, manager: event.target.value }))}
                  placeholder={copy.managerPlaceholder}
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                />
              </Field>

              <Field label={copy.capacityLabel} error={errors.capacity}>
                <input
                  value={form.capacity}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, capacity: event.target.value.replace(/[^\d]/g, "") }))
                  }
                  inputMode="numeric"
                  placeholder={copy.capacityPlaceholder}
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                />
              </Field>

              <Field label={copy.statusLabel}>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value as LocationStatus }))
                  }
                  className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                >
                  {locationStatusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="md:col-span-2">
                <Field label={copy.addressLabel} error={errors.address}>
                  <input
                    value={form.address}
                    onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                    placeholder={copy.addressPlaceholder}
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
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:opacity-95"
              >
                {isEditing ? copy.saveChanges : copy.registerLocation}
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
            <h2 className="text-lg font-semibold text-[var(--navy-900)]">{copy.deleteTitle}</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              {deleteDescriptionParts[0]}
              <span className="font-semibold text-[var(--foreground)]">{deleteTarget.name}</span>
              {deleteDescriptionParts[1]}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-xl bg-[#dc2626] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
              >
                {copy.delete}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
