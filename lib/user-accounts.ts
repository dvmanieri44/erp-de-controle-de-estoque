import { dispatchUserAccountsEvent } from "@/lib/app-events";
import { DEFAULT_LANGUAGE_PREFERENCE, loadLanguagePreference, type LanguagePreference } from "@/lib/ui-preferences";

export const USER_ACCOUNTS_STORAGE_KEY = "erp.user-accounts";
const ACTIVE_USER_ACCOUNT_KEY = "erp.active-user-account";
const ACTIVE_LOGIN_USERNAME_KEY = "erp.active-login-username";

export type UserRole = "administrador" | "gestor" | "operador" | "consulta";
export type UserStatus = "ativo" | "inativo";

export type UserAccount = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  unit: string;
  status: UserStatus;
};

const PRIMARY_ADMIN_ACCOUNT_ID = "conta-admin-premierpet";
const PRIMARY_ADMIN_NAME = "Joao Pedro Chiavoloni";
const DEFAULT_SEED_USERNAMES: Record<string, string> = {
  "conta-admin-premierpet": "admin",
  "conta-gestao-supply": "maria",
  "conta-operacao-cd": "joao",
  "conta-auditoria": "auditoria",
};

let userAccountsHydrationPromise: Promise<void> | null = null;
let userAccountsHydrated = false;

function resolveLanguage(language?: LanguagePreference) {
  if (language) {
    return language;
  }

  return typeof window === "undefined" ? DEFAULT_LANGUAGE_PREFERENCE : loadLanguagePreference();
}

const USER_ROLE_COPY: Record<LanguagePreference, Record<UserRole, { label: string; helper: string }>> = {
  "pt-BR": {
    administrador: { label: "Administrador", helper: "Acesso total ao sistema e as configuracoes" },
    gestor: { label: "Gestor", helper: "Acompanha a operacao e gerencia areas da unidade" },
    operador: { label: "Operador", helper: "Registra movimentacoes e acompanha execucoes" },
    consulta: { label: "Consulta", helper: "Visualiza informacoes sem editar dados criticos" },
  },
  "en-US": {
    administrador: { label: "Administrator", helper: "Full access to the system and settings" },
    gestor: { label: "Manager", helper: "Monitors the operation and manages unit areas" },
    operador: { label: "Operator", helper: "Records movements and follows executions" },
    consulta: { label: "Viewer", helper: "Can view information without editing critical data" },
  },
  "es-ES": {
    administrador: { label: "Administrador", helper: "Acceso total al sistema y a la configuracion" },
    gestor: { label: "Gestor", helper: "Acompana la operacion y gestiona areas de la unidad" },
    operador: { label: "Operador", helper: "Registra movimientos y acompana ejecuciones" },
    consulta: { label: "Consulta", helper: "Visualiza informacion sin editar datos criticos" },
  },
};

const USER_STATUS_COPY: Record<LanguagePreference, Record<UserStatus, string>> = {
  "pt-BR": { ativo: "Ativo", inativo: "Inativo" },
  "en-US": { ativo: "Active", inativo: "Inactive" },
  "es-ES": { ativo: "Activo", inativo: "Inactivo" },
};

export const USER_ROLE_OPTIONS: Array<{ value: UserRole; label: string; helper: string }> = [
  { value: "administrador", ...USER_ROLE_COPY["pt-BR"].administrador },
  { value: "gestor", ...USER_ROLE_COPY["pt-BR"].gestor },
  { value: "operador", ...USER_ROLE_COPY["pt-BR"].operador },
  { value: "consulta", ...USER_ROLE_COPY["pt-BR"].consulta },
];

export const USER_STATUS_OPTIONS: Array<{ value: UserStatus; label: string }> = [
  { value: "ativo", label: USER_STATUS_COPY["pt-BR"].ativo },
  { value: "inativo", label: USER_STATUS_COPY["pt-BR"].inativo },
];

export const INITIAL_USER_ACCOUNTS: UserAccount[] = [
  {
    id: PRIMARY_ADMIN_ACCOUNT_ID,
    name: PRIMARY_ADMIN_NAME,
    username: "admin",
    email: "marina.azevedo@premierpet.com.br",
    role: "administrador",
    unit: "Matriz Dourado",
    status: "ativo",
  },
  {
    id: "conta-gestao-supply",
    name: "Equipe de Supply",
    username: "maria",
    email: "supply@premierpet.com.br",
    role: "gestor",
    unit: "Planejamento Logistico",
    status: "ativo",
  },
  {
    id: "conta-operacao-cd",
    name: "Logistica Dourado",
    username: "joao",
    email: "logistica.dourado@premierpet.com.br",
    role: "operador",
    unit: "Complexo Industrial Dourado",
    status: "ativo",
  },
  {
    id: "conta-auditoria",
    name: "Auditoria Interna",
    username: "auditoria",
    email: "auditoria@premierpet.com.br",
    role: "consulta",
    unit: "Compliance Operacional",
    status: "ativo",
  },
] as const;

function getUserAccountsEndpoint() {
  return "/api/auth/accounts";
}

function isUserRole(value: unknown): value is UserRole {
  return value === "administrador" || value === "gestor" || value === "operador" || value === "consulta";
}

function isUserStatus(value: unknown): value is UserStatus {
  return value === "ativo" || value === "inativo";
}

function serializeAccounts(accounts: UserAccount[]) {
  return JSON.stringify(accounts);
}

function getSessionStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage;
}

function getLocalStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function setCachedUserAccounts(accounts: UserAccount[]) {
  const localStorage = getLocalStorage();

  if (!localStorage) {
    return;
  }

  const normalizedAccounts = normalizeUserAccounts(accounts);
  const serializedAccounts = serializeAccounts(normalizedAccounts);

  userAccountsHydrated = true;

  if (localStorage.getItem(USER_ACCOUNTS_STORAGE_KEY) === serializedAccounts) {
    return;
  }

  localStorage.setItem(USER_ACCOUNTS_STORAGE_KEY, serializedAccounts);
  dispatchUserAccountsEvent();
}

export function clearCachedUserAccounts() {
  const localStorage = getLocalStorage();

  if (!localStorage) {
    return;
  }

  userAccountsHydrated = false;

  if (localStorage.getItem(USER_ACCOUNTS_STORAGE_KEY) === null) {
    return;
  }

  localStorage.removeItem(USER_ACCOUNTS_STORAGE_KEY);
  dispatchUserAccountsEvent();
}

export function normalizeLoginUsername(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");
}

export function resolveUserAccountUsername(account: {
  id?: string;
  username?: string;
  email?: string;
  name?: string;
}) {
  if (typeof account.username === "string") {
    const normalizedUsername = normalizeLoginUsername(account.username);

    if (normalizedUsername) {
      return normalizedUsername;
    }
  }

  if (typeof account.id === "string" && DEFAULT_SEED_USERNAMES[account.id]) {
    return DEFAULT_SEED_USERNAMES[account.id]!;
  }

  if (typeof account.email === "string") {
    const emailUsername = normalizeLoginUsername(account.email.split("@")[0] ?? "");

    if (emailUsername) {
      return emailUsername;
    }
  }

  if (typeof account.name === "string") {
    const nameUsername = normalizeLoginUsername(account.name);

    if (nameUsername) {
      return nameUsername;
    }
  }

  return typeof account.id === "string" ? normalizeLoginUsername(account.id) : "";
}

export function normalizeUserAccount(account: UserAccount): UserAccount {
  return {
    ...account,
    name: account.id === PRIMARY_ADMIN_ACCOUNT_ID ? PRIMARY_ADMIN_NAME : account.name,
    username: resolveUserAccountUsername(account),
  };
}

export function normalizeUserAccounts(accounts: UserAccount[]) {
  return accounts.map((account) => normalizeUserAccount(account));
}

export function parseUserAccountRecord(record: Record<string, unknown>) {
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.email !== "string" ||
    !isUserRole(record.role) ||
    typeof record.unit !== "string" ||
    !isUserStatus(record.status)
  ) {
    return null;
  }

  const username = resolveUserAccountUsername({
    id: record.id,
    username: typeof record.username === "string" ? record.username : undefined,
    email: record.email,
    name: record.name,
  });

  if (!username) {
    return null;
  }

  return normalizeUserAccount({
    id: record.id,
    name: record.name,
    username,
    email: record.email,
    role: record.role,
    unit: record.unit,
    status: record.status,
  });
}

function parseStoredAccounts(raw: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return [] as UserAccount[];
  }

  if (!Array.isArray(parsed)) {
    return [] as UserAccount[];
  }

  return parsed
    .map((item) => (item && typeof item === "object" ? parseUserAccountRecord(item as Record<string, unknown>) : null))
    .filter((item): item is UserAccount => item !== null);
}

export function syncUserAccountsFromBackendInBackground() {
  if (typeof window === "undefined" || userAccountsHydrationPromise || userAccountsHydrated) {
    return;
  }

  userAccountsHydrationPromise = fetch(getUserAccountsEndpoint(), {
    method: "GET",
    cache: "no-store",
  })
    .then(async (response) => {
      if (response.status === 401) {
        clearCachedUserAccounts();
        return;
      }

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { accounts?: unknown };

      if (!Array.isArray(payload.accounts)) {
        return;
      }

      const accounts = payload.accounts
        .map((item) =>
          item && typeof item === "object" ? parseUserAccountRecord(item as Record<string, unknown>) : null,
        )
        .filter((item): item is UserAccount => item !== null);

      setCachedUserAccounts(accounts);
    })
    .catch(() => {
      return;
    })
    .finally(() => {
      userAccountsHydrationPromise = null;
    });
}

export function clearLegacyClientAuthState() {
  const sessionStorage = getSessionStorage();
  const localStorage = getLocalStorage();

  sessionStorage?.removeItem(ACTIVE_USER_ACCOUNT_KEY);
  sessionStorage?.removeItem(ACTIVE_LOGIN_USERNAME_KEY);

  if (localStorage) {
    localStorage.removeItem(ACTIVE_USER_ACCOUNT_KEY);
    localStorage.removeItem(ACTIVE_LOGIN_USERNAME_KEY);
  }
}

export function getUserRoleOptions(language?: LanguagePreference) {
  const locale = resolveLanguage(language);
  return (Object.keys(USER_ROLE_COPY[locale]) as UserRole[]).map((value) => ({
    value,
    label: USER_ROLE_COPY[locale][value].label,
    helper: USER_ROLE_COPY[locale][value].helper,
  }));
}

export function getUserStatusOptions(language?: LanguagePreference) {
  const locale = resolveLanguage(language);
  return (Object.keys(USER_STATUS_COPY[locale]) as UserStatus[]).map((value) => ({
    value,
    label: USER_STATUS_COPY[locale][value],
  }));
}

export function getUserStatusLabel(status: UserStatus, language?: LanguagePreference) {
  return USER_STATUS_COPY[resolveLanguage(language)][status];
}

export function createUserAccountId(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getUserRoleLabel(role: UserRole, language?: LanguagePreference) {
  return USER_ROLE_COPY[resolveLanguage(language)][role].label;
}

export function loadUserAccounts() {
  if (typeof window === "undefined") {
    return normalizeUserAccounts([...INITIAL_USER_ACCOUNTS]);
  }

  clearLegacyClientAuthState();
  syncUserAccountsFromBackendInBackground();

  const raw = window.localStorage.getItem(USER_ACCOUNTS_STORAGE_KEY);

  if (!raw) {
    return [] as UserAccount[];
  }

  return parseStoredAccounts(raw);
}

export function saveUserAccounts(accounts: UserAccount[]) {
  if (typeof window === "undefined") {
    return;
  }

  setCachedUserAccounts(accounts);
}
