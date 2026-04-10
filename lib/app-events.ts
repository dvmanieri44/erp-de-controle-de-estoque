export const ERP_DATA_EVENT = "erp-data-changed";
export const USER_ACCOUNTS_EVENT = "erp-user-accounts-changed";

export function dispatchErpDataEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ERP_DATA_EVENT));
}

export function dispatchUserAccountsEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(USER_ACCOUNTS_EVENT));
}
