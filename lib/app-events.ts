export const ERP_DATA_EVENT = "erp-data-changed";

export function dispatchErpDataEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ERP_DATA_EVENT));
}
