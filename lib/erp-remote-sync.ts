import { dispatchErpDataEvent, dispatchUserAccountsEvent } from "@/lib/app-events";
import { confirmAction, showToast } from "@/lib/client-feedback";
import {
  ERP_RESOURCE_DEFINITIONS,
  type ErpResourceId,
  type ErpResourceMap,
} from "@/lib/erp-data-resources";

type ErpStateResponse<TKey extends ErpResourceId> = {
  resource: TKey;
  data: ErpResourceMap[TKey];
  exists: boolean;
  updatedAt: string | null;
  version: number;
};

type ResourceSyncMeta = {
  serverVersion: number | null;
  dirty: boolean;
  conflict: boolean;
};

const DEFAULT_SYNC_META: ResourceSyncMeta = {
  serverVersion: null,
  dirty: false,
  conflict: false,
};

const hydrationLocks = new Set<ErpResourceId>();
const hydratedResources = new Set<ErpResourceId>();
const persistQueues = new Map<ErpResourceId, Promise<void>>();
const localMutationVersions = new Map<ErpResourceId, number>();
const reportedPermissionErrors = new Set<ErpResourceId>();
const reportedVersionConflicts = new Set<ErpResourceId>();

function canUseRemoteBackend() {
  return typeof window !== "undefined";
}

function dispatchResourceEvent(resource: ErpResourceId) {
  const definition = ERP_RESOURCE_DEFINITIONS[resource];

  if (definition.event === "user-accounts") {
    dispatchUserAccountsEvent();
    return;
  }

  dispatchErpDataEvent();
}

function getResourceEndpoint(resource: ErpResourceId) {
  return `/api/erp/state/${encodeURIComponent(resource)}`;
}

function getResourceMetaStorageKey(resource: ErpResourceId) {
  return `${ERP_RESOURCE_DEFINITIONS[resource].localStorageKey}.sync-meta`;
}

export function clearLocalErpResourceCaches() {
  if (!canUseRemoteBackend()) {
    return;
  }

  for (const resource of Object.keys(ERP_RESOURCE_DEFINITIONS) as ErpResourceId[]) {
    const definition = ERP_RESOURCE_DEFINITIONS[resource];
    window.localStorage.removeItem(definition.localStorageKey);
    window.localStorage.removeItem(getResourceMetaStorageKey(resource));
  }

  hydrationLocks.clear();
  hydratedResources.clear();
  persistQueues.clear();
  localMutationVersions.clear();
  reportedPermissionErrors.clear();
  reportedVersionConflicts.clear();
  dispatchErpDataEvent();
}

function getResourceDisplayName(resource: ErpResourceId) {
  return resource.replace(/\./g, " / ");
}

function reloadResourceFromServer(resource: ErpResourceId) {
  localMutationVersions.delete(resource);
  reportedPermissionErrors.delete(resource);
  reportedVersionConflicts.delete(resource);
  writeResourceSyncMeta(resource, {
    serverVersion: readResourceSyncMeta(resource).serverVersion,
    dirty: false,
    conflict: false,
  });
  hydratedResources.delete(resource);
  syncResourceFromBackendInBackground(resource, {
    force: true,
    overwriteLocal: true,
  });
}

function notifyPermissionDenied(resource: ErpResourceId) {
  if (reportedPermissionErrors.has(resource)) {
    return;
  }

  reportedPermissionErrors.add(resource);

  showToast(
    `Sua conta nao tem permissao para alterar ${getResourceDisplayName(resource)}. Os dados locais serao recarregados do servidor.`,
  );
}

function notifyVersionConflict(resource: ErpResourceId) {
  if (reportedVersionConflicts.has(resource)) {
    return;
  }

  reportedVersionConflicts.add(resource);

  const shouldReload = confirmAction(
    `Os dados de ${getResourceDisplayName(resource)} foram alterados por outra sessao. Deseja recarregar a versao mais recente do servidor agora?`,
  );

  if (shouldReload) {
    reloadResourceFromServer(resource);
  }
}

function readResourceSyncMeta(resource: ErpResourceId): ResourceSyncMeta {
  if (!canUseRemoteBackend()) {
    return DEFAULT_SYNC_META;
  }

  const raw = window.localStorage.getItem(getResourceMetaStorageKey(resource));

  if (!raw) {
    return DEFAULT_SYNC_META;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ResourceSyncMeta>;

    return {
      serverVersion:
        typeof parsed.serverVersion === "number" && Number.isInteger(parsed.serverVersion)
          ? parsed.serverVersion
          : null,
      dirty: parsed.dirty === true,
      conflict: parsed.conflict === true,
    };
  } catch {
    return DEFAULT_SYNC_META;
  }
}

function writeResourceSyncMeta(resource: ErpResourceId, meta: ResourceSyncMeta) {
  if (!canUseRemoteBackend()) {
    return;
  }

  window.localStorage.setItem(getResourceMetaStorageKey(resource), JSON.stringify(meta));
}

function setLocalResourceData<TKey extends ErpResourceId>(
  resource: TKey,
  data: ErpResourceMap[TKey],
) {
  const storageKey = ERP_RESOURCE_DEFINITIONS[resource].localStorageKey;
  const serializedData = JSON.stringify(data);

  if (window.localStorage.getItem(storageKey) === serializedData) {
    return;
  }

  window.localStorage.setItem(storageKey, serializedData);
  dispatchResourceEvent(resource);
}

function markLocalMutation(resource: ErpResourceId) {
  const nextVersion = (localMutationVersions.get(resource) ?? 0) + 1;
  localMutationVersions.set(resource, nextVersion);
  reportedVersionConflicts.delete(resource);

  const currentMeta = readResourceSyncMeta(resource);
  writeResourceSyncMeta(resource, {
    ...currentMeta,
    dirty: true,
  });

  return nextVersion;
}

export function syncResourceFromBackendInBackground(
  resource: ErpResourceId,
  options?: {
    force?: boolean;
    overwriteLocal?: boolean;
  },
) {
  if (
    !canUseRemoteBackend() ||
    hydrationLocks.has(resource) ||
    (!options?.force && hydratedResources.has(resource))
  ) {
    return;
  }

  hydrationLocks.add(resource);

  const definition = ERP_RESOURCE_DEFINITIONS[resource];

  void fetch(getResourceEndpoint(resource), {
    method: "GET",
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as ErpStateResponse<typeof resource>;
      const localRaw = window.localStorage.getItem(definition.localStorageKey);
      const syncMeta = readResourceSyncMeta(resource);
      const canOverwriteLocal =
        options?.overwriteLocal === true || !syncMeta.dirty || !localRaw;

      hydratedResources.add(resource);

      if (!canOverwriteLocal || syncMeta.conflict) {
        return;
      }

      setLocalResourceData(resource, payload.data);
      writeResourceSyncMeta(resource, {
        serverVersion: payload.version,
        dirty: false,
        conflict: false,
      });
    })
    .catch(() => {
      return;
    })
    .finally(() => {
      hydrationLocks.delete(resource);
    });
}

export function persistResourceToBackendInBackground<TKey extends ErpResourceId>(
  resource: TKey,
  data: ErpResourceMap[TKey],
) {
  if (!canUseRemoteBackend()) {
    return;
  }

  const mutationVersion = markLocalMutation(resource);

  const queued = (persistQueues.get(resource) ?? Promise.resolve())
    .catch(() => {
      return;
    })
    .then(async () => {
      const syncMeta = readResourceSyncMeta(resource);
      const response = await fetch(getResourceEndpoint(resource), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data,
          baseVersion: syncMeta.serverVersion,
        }),
      });

      if (response.ok) {
        const payload = (await response.json()) as ErpStateResponse<TKey>;
        const hasNewerLocalMutation =
          (localMutationVersions.get(resource) ?? 0) !== mutationVersion;

        hydratedResources.add(resource);

        if (!hasNewerLocalMutation) {
          setLocalResourceData(resource, payload.data);
          localMutationVersions.delete(resource);
        }

        writeResourceSyncMeta(resource, {
          serverVersion: payload.version,
          dirty: hasNewerLocalMutation,
          conflict: false,
        });
        reportedPermissionErrors.delete(resource);
        reportedVersionConflicts.delete(resource);
        return;
      }

      if (response.status === 409) {
        const currentMeta = readResourceSyncMeta(resource);

        writeResourceSyncMeta(resource, {
          ...currentMeta,
          dirty: true,
          conflict: true,
        });
        notifyVersionConflict(resource);
        return;
      }

      if (response.status === 401 || response.status === 403) {
        localMutationVersions.delete(resource);
        writeResourceSyncMeta(resource, {
          serverVersion: null,
          dirty: false,
          conflict: false,
        });
        hydratedResources.delete(resource);
        if (response.status === 403) {
          notifyPermissionDenied(resource);
        }
        syncResourceFromBackendInBackground(resource, {
          force: true,
          overwriteLocal: true,
        });
        return;
      }

      const currentMeta = readResourceSyncMeta(resource);
      writeResourceSyncMeta(resource, {
        ...currentMeta,
        dirty: true,
      });
      throw new Error(`Falha ao persistir ${resource}`);
    });

  persistQueues.set(resource, queued);
}
