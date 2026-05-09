import "server-only";

import { isFirebaseConfigured } from "@/lib/server/firebase-admin";

export type ServerPersistenceProvider = "firebase" | "file";

function isNonProductionRuntime() {
  return process.env.NODE_ENV !== "production";
}

export function canUseLocalFilePersistenceFallback() {
  return isNonProductionRuntime();
}

export function getServerPersistenceProvider(
  scope: string,
): ServerPersistenceProvider {
  if (isFirebaseConfigured()) {
    return "firebase";
  }

  if (canUseLocalFilePersistenceFallback()) {
    return "file";
  }

  throw new Error(
    `Firebase Admin obrigatorio em producao para a persistencia de ${scope}.`,
  );
}

export function describeServerPersistence(scope: string) {
  try {
    return {
      provider: getServerPersistenceProvider(scope),
      firebaseConfigured: isFirebaseConfigured(),
      localFallbackAllowed: canUseLocalFilePersistenceFallback(),
      misconfigured: false,
    };
  } catch (error) {
    return {
      provider: null,
      firebaseConfigured: isFirebaseConfigured(),
      localFallbackAllowed: canUseLocalFilePersistenceFallback(),
      misconfigured: true,
      error: error instanceof Error ? error.message : "Erro desconhecido.",
    };
  }
}
