export type ToastTone = "info" | "success" | "warning" | "error";

type ToastOptions = {
  tone?: ToastTone;
};

export function confirmAction(message: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.confirm(message);
}

export function showToast(message: string, _options?: ToastOptions) {
  if (typeof window === "undefined") {
    return;
  }

  void _options;
  window.alert(message);
}
