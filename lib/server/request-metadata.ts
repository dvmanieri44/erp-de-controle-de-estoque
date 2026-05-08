import "server-only";

export type RequestMetadata = {
  ip: string | null;
  userAgent: string | null;
  path: string | null;
  method: string;
};

function normalizeIp(value: string | null) {
  if (!value) {
    return null;
  }

  const forwardedIp = value.split(",")[0]?.trim() ?? "";
  return forwardedIp || null;
}

export function getRequestMetadata(request: Request): RequestMetadata {
  const url = new URL(request.url);

  return {
    ip: normalizeIp(request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip")),
    userAgent: request.headers.get("user-agent"),
    path: url.pathname,
    method: request.method,
  };
}
