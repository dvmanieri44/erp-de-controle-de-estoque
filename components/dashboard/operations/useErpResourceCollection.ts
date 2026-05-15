"use client";

import { useEffect, useState } from "react";

import {
  ERP_RESOURCE_CHANGED_EVENT,
  type ErpResourceChangedDetail,
} from "@/lib/app-events";
import {
  ERP_RESOURCE_DEFINITIONS,
  type ErpResourceId,
} from "@/lib/erp-data-resources";

export function useErpResourceCollection<T>(
  resource: ErpResourceId,
  loader: () => T[],
) {
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    const storageKey = ERP_RESOURCE_DEFINITIONS[resource].localStorageKey;

    const sync = () => {
      setItems(loader());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== storageKey) {
        return;
      }

      sync();
    };

    const handleResourceChange = (
      event: Event,
    ) => {
      const customEvent = event as CustomEvent<ErpResourceChangedDetail>;

      if (customEvent.detail?.resource !== resource) {
        return;
      }

      sync();
    };

    sync();
    window.addEventListener("storage", handleStorage);
    window.addEventListener(ERP_RESOURCE_CHANGED_EVENT, handleResourceChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        ERP_RESOURCE_CHANGED_EVENT,
        handleResourceChange,
      );
    };
  }, [loader, resource]);

  return [items, setItems] as const;
}
