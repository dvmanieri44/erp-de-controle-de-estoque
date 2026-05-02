type ErpQueryEntry<TValue> = {
  value?: TValue;
  updatedAt: number;
  promise?: Promise<TValue>;
};

type ErpQueryOptions = {
  force?: boolean;
  staleMs?: number;
};

const DEFAULT_STALE_MS = 30_000;
const queryCache = new Map<string, ErpQueryEntry<unknown>>();

function getCacheEntry<TValue>(resource: string) {
  return queryCache.get(resource) as ErpQueryEntry<TValue> | undefined;
}

function isFresh<TValue>(
  entry: ErpQueryEntry<TValue> | undefined,
  staleMs: number,
): entry is ErpQueryEntry<TValue> & { value: TValue } {
  return (
    entry?.value !== undefined &&
    entry.updatedAt > 0 &&
    Date.now() - entry.updatedAt < staleMs
  );
}

async function query<TValue>(
  resource: string,
  fetcher: () => Promise<TValue>,
  options?: ErpQueryOptions,
) {
  const staleMs = options?.staleMs ?? DEFAULT_STALE_MS;
  const entry = getCacheEntry<TValue>(resource);

  if (!options?.force && isFresh(entry, staleMs)) {
    return entry.value as TValue;
  }

  if (!options?.force && entry?.promise) {
    return entry.promise;
  }

  const nextPromise = fetcher()
    .then((value) => {
      queryCache.set(resource, {
        value,
        updatedAt: Date.now(),
      });
      return value;
    })
    .finally(() => {
      const currentEntry = getCacheEntry<TValue>(resource);

      if (currentEntry?.promise === nextPromise) {
        queryCache.set(resource, {
          value: currentEntry.value,
          updatedAt: currentEntry.updatedAt,
        });
      }
    });

  queryCache.set(resource, {
    value: entry?.value,
    updatedAt: entry?.updatedAt ?? 0,
    promise: nextPromise,
  });

  return nextPromise;
}

function refresh<TValue>(
  resource: string,
  fetcher: () => Promise<TValue>,
  options?: Omit<ErpQueryOptions, "force">,
) {
  return query(resource, fetcher, {
    ...options,
    force: true,
  });
}

function invalidate(resource: string) {
  queryCache.delete(resource);
}

function prime<TValue>(resource: string, value: TValue) {
  queryCache.set(resource, {
    value,
    updatedAt: Date.now(),
  });
}

export const erpQueryClient = {
  invalidate,
  prime,
  query,
  refresh,
};
