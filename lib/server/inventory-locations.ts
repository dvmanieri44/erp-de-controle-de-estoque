import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { LocationItem } from "@/lib/inventory";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import { listLots } from "@/lib/server/inventory-lots";
import {
  calculateLocationStockBalances,
  listInventoryMovements,
} from "@/lib/server/inventory-movements";
import {
  ErpResourceValidationError,
  sanitizeStoredErpResourceItemData,
  validateErpResourceItemData,
} from "@/lib/server/erp-resource-schema";
import { readErpResource } from "@/lib/server/erp-state";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const INVENTORY_LOCATIONS_COLLECTION = "inventoryLocations";
const LOCATIONS_RESOURCE_ID = "inventory.locations";
const DEFAULT_INVENTORY_LOCATIONS_FILE = path.join(
  process.cwd(),
  ".data",
  "inventory-locations.json",
);

let fileWriteQueue = Promise.resolve();

type LocationVersion = number;

type StoredInventoryLocationDocument = LocationItem & {
  version: LocationVersion;
  updatedAt: string | null;
  deleted?: false;
};

type DeletedInventoryLocationDocument = {
  id: string;
  deleted: true;
  deletedAt: string;
  version: LocationVersion;
  updatedAt: string | null;
};

type InventoryLocationItemRecord = {
  location: InventoryLocationRecord | null;
  exists: boolean;
  deleted?: boolean;
};

type InventoryLocationMergeEntry =
  | { type: "location"; location: StoredInventoryLocationDocument }
  | { type: "deleted"; location: DeletedInventoryLocationDocument };

type StoredInventoryLocationEntry =
  | StoredInventoryLocationDocument
  | DeletedInventoryLocationDocument;

type DeleteInventoryLocationResult = {
  id: string;
  version: LocationVersion;
  deletedAt: string;
};

type InventoryLocationsFileStore = {
  items?: Record<string, StoredInventoryLocationEntry>;
};

export type InventoryLocationRecord = LocationItem & {
  version: LocationVersion;
  updatedAt: string | null;
};

export type ListInventoryLocationsResult = {
  items: InventoryLocationRecord[];
  count: number;
};

export type UpdateInventoryLocationOptions = {
  baseVersion: number;
};

type LocationDocumentMutationResult =
  | { type: "set"; value: LocationItem }
  | { type: "noop"; value: InventoryLocationRecord }
  | { type: "delete"; value: InventoryLocationRecord };

export class InventoryLocationConflictError extends Error {
  status: number;
  currentVersion: number;
  currentUpdatedAt: string | null;

  constructor(
    message: string,
    currentVersion: number,
    currentUpdatedAt: string | null,
  ) {
    super(message);
    this.status = 409;
    this.currentVersion = currentVersion;
    this.currentUpdatedAt = currentUpdatedAt;
  }
}

export class InventoryLocationNotFoundError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.status = 404;
  }
}

export class InventoryLocationInUseError extends Error {
  status: number;
  reasons: string[];

  constructor(message: string, reasons: string[]) {
    super(message);
    this.status = 409;
    this.reasons = reasons;
  }
}

export function requireInventoryLocationBaseVersion(
  value: unknown,
  operation: string,
) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ErpResourceValidationError(
      `baseVersion obrigatorio para ${operation} a localizacao.`,
      400,
    );
  }

  return value;
}

export function getInventoryLocationVersionConflictPayload(
  error: InventoryLocationConflictError,
) {
  return {
    error: "VERSION_CONFLICT" as const,
    currentVersion: error.currentVersion,
  };
}

function getInventoryLocationsFilePath() {
  return process.env.INVENTORY_LOCATIONS_FILE_PATH
    ? path.resolve(process.cwd(), process.env.INVENTORY_LOCATIONS_FILE_PATH)
    : DEFAULT_INVENTORY_LOCATIONS_FILE;
}

function queueFileWrite<T>(operation: () => Promise<T>) {
  const nextOperation = fileWriteQueue.then(operation, operation);
  fileWriteQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
}

async function readInventoryLocationsFileStore() {
  try {
    const raw = await readFile(getInventoryLocationsFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        items: {},
      } satisfies Required<InventoryLocationsFileStore>;
    }

    const value = parsed as InventoryLocationsFileStore;

    return {
      items: normalizeFileItems(value.items),
    } satisfies Required<InventoryLocationsFileStore>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        items: {},
      } satisfies Required<InventoryLocationsFileStore>;
    }

    throw error;
  }
}

function normalizeStoredLocationDocument(
  locationId: string,
  value: unknown,
): StoredInventoryLocationDocument | null {
  const sanitized = sanitizeStoredErpResourceItemData(LOCATIONS_RESOURCE_ID, value);
  const item = sanitized.item;

  if (!item || item.id !== locationId) {
    return null;
  }

  const candidate = value as Partial<StoredInventoryLocationDocument>;

  return {
    ...item,
    updatedAt:
      typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    version:
      typeof candidate.version === "number" &&
      Number.isInteger(candidate.version) &&
      candidate.version >= 1
        ? candidate.version
        : 1,
  };
}

function normalizeDeletedLocationDocument(
  locationId: string,
  value: unknown,
): DeletedInventoryLocationDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<DeletedInventoryLocationDocument>;

  if (
    candidate.deleted !== true ||
    candidate.id !== locationId ||
    typeof candidate.deletedAt !== "string"
  ) {
    return null;
  }

  return {
    id: locationId,
    deleted: true,
    deletedAt: candidate.deletedAt,
    updatedAt:
      typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    version:
      typeof candidate.version === "number" &&
      Number.isInteger(candidate.version) &&
      candidate.version >= 1
        ? candidate.version
        : 1,
  };
}

function normalizeStoredLocationEntry(
  locationId: string,
  value: unknown,
): InventoryLocationMergeEntry | null {
  const deletedLocation = normalizeDeletedLocationDocument(locationId, value);

  if (deletedLocation) {
    return {
      type: "deleted",
      location: deletedLocation,
    };
  }

  const location = normalizeStoredLocationDocument(locationId, value);

  if (!location) {
    return null;
  }

  return {
    type: "location",
    location,
  };
}

function toStoredLocationEntry(
  entry: InventoryLocationMergeEntry,
): StoredInventoryLocationEntry {
  if (entry.type === "deleted") {
    return entry.location;
  }

  return entry.location;
}

function toLocationMergeEntry(
  document: StoredInventoryLocationEntry,
): InventoryLocationMergeEntry {
  if ("deleted" in document && document.deleted === true) {
    return {
      type: "deleted",
      location: document,
    };
  }

  return {
    type: "location",
    location: document,
  };
}

function normalizeFileItems(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, StoredInventoryLocationEntry>;
  }

  const items: Record<string, StoredInventoryLocationEntry> = {};

  for (const [locationId, candidate] of Object.entries(value)) {
    const normalized = normalizeStoredLocationEntry(locationId, candidate);

    if (normalized) {
      items[locationId] = toStoredLocationEntry(normalized);
    }
  }

  return items;
}

function sortLocations<TValue extends LocationItem>(items: TValue[]) {
  return [...items].sort((left, right) => left.id.localeCompare(right.id));
}

function areLocationPayloadsEqual(left: LocationItem, right: LocationItem) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toLocationPayload(
  location: InventoryLocationRecord | null,
): LocationItem | null {
  if (!location) {
    return null;
  }

  const payload = { ...location } as Partial<InventoryLocationRecord>;
  delete payload.version;
  delete payload.updatedAt;
  return payload as LocationItem;
}

function validateLocationWritePayload(value: unknown, locationId?: string) {
  const normalized = validateErpResourceItemData(LOCATIONS_RESOURCE_ID, value);

  if (locationId && normalized.id !== locationId) {
    throw new ErpResourceValidationError(
      "O id da localizacao precisa corresponder ao id da rota.",
    );
  }

  return normalized;
}

function assertBaseVersion(
  current: InventoryLocationRecord | null,
  baseVersion: number,
): asserts current is InventoryLocationRecord {
  if (!Number.isInteger(baseVersion) || baseVersion < 1) {
    throw new ErpResourceValidationError(
      "Versao base invalida para a localizacao.",
    );
  }

  if (!current) {
    throw new InventoryLocationNotFoundError("Localizacao nao encontrada.");
  }

  if (current.version === baseVersion) {
    return;
  }

  throw new InventoryLocationConflictError(
    "A localizacao foi alterada por outra sessao. Recarregue os dados antes de salvar novamente.",
    current.version,
    current.updatedAt,
  );
}

function assertLocationWriteResult(
  value: InventoryLocationRecord | DeletedInventoryLocationDocument,
): asserts value is InventoryLocationRecord {
  if ("deleted" in value && value.deleted === true) {
    throw new Error("Operacao de localizacao retornou um marcador de exclusao inesperado.");
  }
}

function assertLocationDeleteResult(
  value: InventoryLocationRecord | DeletedInventoryLocationDocument,
): asserts value is DeletedInventoryLocationDocument {
  if (!("deleted" in value) || value.deleted !== true) {
    throw new Error("Operacao de exclusao da localizacao nao gerou marcador de exclusao.");
  }
}

function normalizeLocationReference(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function movementReferencesLocation(
  movement: {
    locationId?: string;
    fromLocationId?: string;
    toLocationId?: string;
  },
  locationId: string,
) {
  return (
    movement.locationId === locationId ||
    movement.fromLocationId === locationId ||
    movement.toLocationId === locationId
  );
}

async function assertLocationCanBeDeleted(location: InventoryLocationRecord) {
  const [movementsPayload, lotsPayload] = await Promise.all([
    listInventoryMovements(),
    listLots(),
  ]);
  const reasons = new Set<string>();

  if (
    movementsPayload.items.some((movement) =>
      movementReferencesLocation(movement, location.id),
    )
  ) {
    reasons.add("MOVEMENTS");
  }

  const activeBalance =
    calculateLocationStockBalances(movementsPayload.items).find(
      (item) => item.locationId === location.id,
    )?.balance ?? 0;

  if (activeBalance !== 0) {
    reasons.add("ACTIVE_STOCK");
  }

  const normalizedLocationName = normalizeLocationReference(location.name);

  if (
    lotsPayload.items.some(
      (lot) =>
        lot.locationId === location.id ||
        normalizeLocationReference(lot.location) === normalizedLocationName,
    )
  ) {
    reasons.add("LOTS");
  }

  if (reasons.size === 0) {
    return;
  }

  throw new InventoryLocationInUseError(
    "A localizacao possui vinculos operacionais e nao pode ser excluida.",
    [...reasons],
  );
}

function buildLegacyLocationRecord(
  location: LocationItem,
  updatedAt: string | null,
): InventoryLocationRecord {
  return {
    ...location,
    version: 1,
    updatedAt,
  };
}

async function readLegacyLocationsSnapshot() {
  return readErpResource(LOCATIONS_RESOURCE_ID);
}

function mergeInventoryLocations(
  itemizedLocations: readonly InventoryLocationMergeEntry[],
  legacyLocations: readonly LocationItem[],
  legacyUpdatedAt: string | null,
) {
  const merged = new Map<string, InventoryLocationRecord>();
  const deletedLocationIds = new Set<string>();

  for (const entry of itemizedLocations) {
    if (entry.type === "deleted") {
      deletedLocationIds.add(entry.location.id);
      merged.delete(entry.location.id);
      continue;
    }

    merged.set(entry.location.id, entry.location);
  }

  for (const legacyLocation of legacyLocations) {
    if (!deletedLocationIds.has(legacyLocation.id) && !merged.has(legacyLocation.id)) {
      merged.set(
        legacyLocation.id,
        buildLegacyLocationRecord(legacyLocation, legacyUpdatedAt),
      );
    }
  }

  return sortLocations([...merged.values()]);
}

async function listFirebaseInventoryLocations() {
  const [snapshot, legacyResource] = await Promise.all([
    getFirebaseAdminDb()
      .collection<StoredInventoryLocationDocument>(INVENTORY_LOCATIONS_COLLECTION)
      .get(),
    readLegacyLocationsSnapshot(),
  ]);

  const itemizedLocations = snapshot.docs
    .map((document) =>
      normalizeStoredLocationEntry(document.id, document.data()),
    )
    .filter(
      (document): document is InventoryLocationMergeEntry => document !== null,
    );

  return mergeInventoryLocations(
    itemizedLocations,
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

async function listFileInventoryLocations() {
  const [store, legacyResource] = await Promise.all([
    readInventoryLocationsFileStore(),
    readLegacyLocationsSnapshot(),
  ]);

  return mergeInventoryLocations(
    Object.values(store.items).map(toLocationMergeEntry),
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

async function readFirebaseInventoryLocation(
  locationId: string,
): Promise<InventoryLocationItemRecord> {
  const snapshot = await getFirebaseAdminDb()
    .collection<StoredInventoryLocationEntry>(INVENTORY_LOCATIONS_COLLECTION)
    .doc(locationId)
    .get();

  if (snapshot.exists) {
    const deletedLocation = normalizeDeletedLocationDocument(
      locationId,
      snapshot.data(),
    );

    if (deletedLocation) {
      return {
        location: null,
        exists: false,
        deleted: true,
      };
    }

    const location = normalizeStoredLocationDocument(locationId, snapshot.data());

    if (location) {
      return {
        location,
        exists: true,
      };
    }
  }

  const legacyResource = await readLegacyLocationsSnapshot();
  const legacyLocation = legacyResource.data.find(
    (candidate) => candidate.id === locationId,
  );

  if (!legacyLocation) {
    return {
      location: null,
      exists: false,
    };
  }

  return {
    location: buildLegacyLocationRecord(legacyLocation, legacyResource.updatedAt),
    exists: true,
  };
}

async function readFileInventoryLocation(
  locationId: string,
): Promise<InventoryLocationItemRecord> {
  const store = await readInventoryLocationsFileStore();
  const document = store.items[locationId] ?? null;

  if (document && "deleted" in document && document.deleted === true) {
    return {
      location: null,
      exists: false,
      deleted: true,
    };
  }

  if (document) {
    return {
      location: document,
      exists: true,
    };
  }

  const legacyResource = await readLegacyLocationsSnapshot();
  const legacyLocation = legacyResource.data.find(
    (candidate) => candidate.id === locationId,
  );

  if (!legacyLocation) {
    return {
      location: null,
      exists: false,
    };
  }

  return {
    location: buildLegacyLocationRecord(legacyLocation, legacyResource.updatedAt),
    exists: true,
  };
}

async function writeFirebaseLocationDocument(
  locationId: string,
  update: (
    current: InventoryLocationRecord | null,
  ) => Promise<LocationDocumentMutationResult>,
) {
  const database = getFirebaseAdminDb();
  const legacyResource = await readLegacyLocationsSnapshot();
  const legacyLocation = legacyResource.data.find(
    (candidate) => candidate.id === locationId,
  );
  const collectionRef =
    database.collection<StoredInventoryLocationEntry>(
      INVENTORY_LOCATIONS_COLLECTION,
    );
  const documentRef = collectionRef.doc(locationId);

  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentRef);
    const deletedLocation = snapshot.exists
      ? normalizeDeletedLocationDocument(locationId, snapshot.data())
      : null;
    const current = snapshot.exists
      ? deletedLocation
        ? null
        : normalizeStoredLocationDocument(locationId, snapshot.data())
      : legacyLocation
        ? buildLegacyLocationRecord(legacyLocation, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    if (next.type === "delete") {
      const deletedAt = new Date().toISOString();
      const deletedDocument: DeletedInventoryLocationDocument = {
        id: locationId,
        deleted: true,
        deletedAt,
        updatedAt: deletedAt,
        version: next.value.version + 1,
      };

      transaction.set(documentRef, deletedDocument, { merge: false });
      return deletedDocument;
    }

    const nextDocument: StoredInventoryLocationDocument = {
      ...next.value,
      updatedAt: new Date().toISOString(),
      version: current ? current.version + 1 : 1,
    };

    transaction.set(documentRef, nextDocument, { merge: false });
    return nextDocument;
  });
}

async function writeFileLocationDocument(
  locationId: string,
  update: (
    current: InventoryLocationRecord | null,
  ) => Promise<LocationDocumentMutationResult>,
) {
  return queueFileWrite(async () => {
    const filePath = getInventoryLocationsFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const [store, legacyResource] = await Promise.all([
      readInventoryLocationsFileStore(),
      readLegacyLocationsSnapshot(),
    ]);
    const legacyLocation = legacyResource.data.find(
      (candidate) => candidate.id === locationId,
    );
    const existingDocument = store.items[locationId] ?? null;
    const current: InventoryLocationRecord | null = existingDocument
      ? "deleted" in existingDocument && existingDocument.deleted === true
        ? null
        : existingDocument
      : legacyLocation
        ? buildLegacyLocationRecord(legacyLocation, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    if (next.type === "delete") {
      const deletedAt = new Date().toISOString();
      const deletedDocument: DeletedInventoryLocationDocument = {
        id: locationId,
        deleted: true,
        deletedAt,
        updatedAt: deletedAt,
        version: next.value.version + 1,
      };

      store.items[locationId] = deletedDocument;
      await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
      return deletedDocument;
    }

    const nextDocument: StoredInventoryLocationDocument = {
      ...next.value,
      updatedAt: new Date().toISOString(),
      version: current ? current.version + 1 : 1,
    };

    store.items[locationId] = nextDocument;
    await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
    return nextDocument;
  });
}

async function writeLocationDocument(
  locationId: string,
  update: (
    current: InventoryLocationRecord | null,
  ) => Promise<LocationDocumentMutationResult>,
) {
  if (getInventoryLocationsPersistenceProvider() === "firebase") {
    return writeFirebaseLocationDocument(locationId, update);
  }

  return writeFileLocationDocument(locationId, update);
}

export function getInventoryLocationsPersistenceProvider() {
  return getServerPersistenceProvider("localizacoes do inventario");
}

export async function listLocations(): Promise<ListInventoryLocationsResult> {
  const items =
    getInventoryLocationsPersistenceProvider() === "firebase"
      ? await listFirebaseInventoryLocations()
      : await listFileInventoryLocations();

  return {
    items,
    count: items.length,
  };
}

export async function getLocationById(locationId: string) {
  const result =
    getInventoryLocationsPersistenceProvider() === "firebase"
      ? await readFirebaseInventoryLocation(locationId)
      : await readFileInventoryLocation(locationId);

  if (!result.exists || !result.location) {
    throw new InventoryLocationNotFoundError("Localizacao nao encontrada.");
  }

  return result.location;
}

export async function createLocation(
  location: unknown,
): Promise<InventoryLocationRecord> {
  const normalized = validateLocationWritePayload(location);

  const createdLocation = await writeLocationDocument(
    normalized.id,
    async (current) => {
      if (current) {
        throw new ErpResourceValidationError(
          "Ja existe uma localizacao com o id informado.",
          409,
        );
      }

      return {
        type: "set",
        value: normalized,
      };
    },
  );

  assertLocationWriteResult(createdLocation);
  return createdLocation;
}

export async function updateLocation(
  locationId: string,
  locationPatch: unknown,
  options: UpdateInventoryLocationOptions,
) {
  const updatedLocation = await writeLocationDocument(
    locationId,
    async (current) => {
      assertBaseVersion(current, options.baseVersion);

      if (
        !locationPatch ||
        typeof locationPatch !== "object" ||
        Array.isArray(locationPatch)
      ) {
        throw new ErpResourceValidationError(
          "Carga invalida para a localizacao.",
        );
      }

      const candidateId = (locationPatch as { id?: unknown }).id;

      if (candidateId !== undefined && candidateId !== locationId) {
        throw new ErpResourceValidationError(
          "O id da localizacao precisa corresponder ao id da rota.",
        );
      }

      const merged = validateLocationWritePayload(
        {
          ...toLocationPayload(current),
          ...locationPatch,
          id: locationId,
        },
        locationId,
      );

      const currentPayload = toLocationPayload(current);

      if (currentPayload && areLocationPayloadsEqual(currentPayload, merged)) {
        return {
          type: "noop",
          value: current,
        } satisfies LocationDocumentMutationResult;
      }

      return {
        type: "set",
        value: merged,
      } satisfies LocationDocumentMutationResult;
    },
  );

  assertLocationWriteResult(updatedLocation);
  return updatedLocation;
}

export async function deleteLocation(
  locationId: string,
  baseVersion: number,
): Promise<DeleteInventoryLocationResult> {
  const deletedLocation = await writeLocationDocument(
    locationId,
    async (current) => {
      assertBaseVersion(current, baseVersion);
      await assertLocationCanBeDeleted(current);

      return {
        type: "delete",
        value: current,
      } satisfies LocationDocumentMutationResult;
    },
  );

  assertLocationDeleteResult(deletedLocation);

  return {
    id: deletedLocation.id,
    version: deletedLocation.version,
    deletedAt: deletedLocation.deletedAt,
  };
}
