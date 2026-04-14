import { dispatchErpDataEvent, dispatchUserAccountsEvent } from "@/lib/app-events";
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
};

const hydrationLocks = new Set<ErpResourceId>();
const hydratedResources = new Set<ErpResourceId>();
const persistQueues = new Map<ErpResourceId, Promise<void>>();

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

export function syncResourceFromBackendInBackground(resource: ErpResourceId) {
  if (!canUseRemoteBackend() || hydrationLocks.has(resource) || hydratedResources.has(resource)) {
    return;
  }

  hydrationLocks.add(resource);

  const definition = ERP_RESOURCE_DEFINITIONS[resource];
  const localRaw = window.localStorage.getItem(definition.localStorageKey);

  void fetch(getResourceEndpoint(resource), {
    method: "GET",
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as ErpStateResponse<typeof resource>;
      const serializedRemoteData = JSON.stringify(payload.data);

      if (!payload.exists && localRaw) {
        try {
          const localValue = JSON.parse(localRaw) as ErpResourceMap[typeof resource];
          hydratedResources.add(resource);
          persistResourceToBackendInBackground(resource, localValue);
        } catch {
          return;
        }

        return;
      }

      hydratedResources.add(resource);

      if (localRaw === serializedRemoteData) {
        return;
      }

      window.localStorage.setItem(definition.localStorageKey, serializedRemoteData);
      dispatchResourceEvent(resource);
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

  const queued = (persistQueues.get(resource) ?? Promise.resolve())
    .catch(() => {
      return;
    })
    .then(async () => {
      const response = await fetch(getResourceEndpoint(resource), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data }),
      });

      if (!response.ok) {
        throw new Error(`Falha ao persistir ${resource}`);
      }

      hydratedResources.add(resource);
    });

  persistQueues.set(resource, queued);
}
