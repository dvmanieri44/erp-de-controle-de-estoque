export const ERP_DATA_EVENT = "erp-data-changed";
export const ERP_RESOURCE_CHANGED_EVENT = "erp-resource-changed";
export const USER_ACCOUNTS_EVENT = "erp-user-accounts-changed";

export type ErpResourceChangedDetail = {
  resource: string;
};

export function dispatchErpDataEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ERP_DATA_EVENT));
}

export function dispatchErpResourceChangedEvent(resource: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ErpResourceChangedDetail>(ERP_RESOURCE_CHANGED_EVENT, {
      detail: {
        resource,
      },
    }),
  );
}

export function dispatchUserAccountsEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(USER_ACCOUNTS_EVENT));
}
