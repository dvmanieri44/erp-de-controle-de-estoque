import { DEFAULT_LANGUAGE_PREFERENCE, loadLanguagePreference, type LanguagePreference } from "@/lib/ui-preferences";

export const USER_ACCOUNTS_STORAGE_KEY = "erp.user-accounts";
export const ACTIVE_USER_ACCOUNT_KEY = "erp.active-user-account";

export type UserRole = "administrador" | "gestor" | "operador" | "consulta";
export type UserStatus = "ativo" | "inativo";

export type UserAccount = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  unit: string;
  status: UserStatus;
};

function resolveLanguage(language?: LanguagePreference) {
  if (language) {
    return language;
  }

  return typeof window === "undefined" ? DEFAULT_LANGUAGE_PREFERENCE : loadLanguagePreference();
}

const USER_ROLE_COPY: Record<LanguagePreference, Record<UserRole, { label: string; helper: string }>> = {
  "pt-BR": {
    administrador: { label: "Administrador", helper: "Acesso total ao sistema e às configurações" },
    gestor: { label: "Gestor", helper: "Acompanha a operação e gerencia áreas da unidade" },
    operador: { label: "Operador", helper: "Registra movimentações e acompanha execuções" },
    consulta: { label: "Consulta", helper: "Visualiza informações sem editar dados críticos" },
  },
  "en-US": {
    administrador: { label: "Administrator", helper: "Full access to the system and settings" },
    gestor: { label: "Manager", helper: "Monitors the operation and manages unit areas" },
    operador: { label: "Operator", helper: "Records movements and follows executions" },
    consulta: { label: "Viewer", helper: "Can view information without editing critical data" },
  },
  "es-ES": {
    administrador: { label: "Administrador", helper: "Acceso total al sistema y a la configuración" },
    gestor: { label: "Gestor", helper: "Acompaña la operación y gestiona áreas de la unidad" },
    operador: { label: "Operador", helper: "Registra movimientos y acompaña ejecuciones" },
    consulta: { label: "Consulta", helper: "Visualiza información sin editar datos críticos" },
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
    id: "conta-admin-premierpet",
    name: "Marina Azevedo",
    email: "marina.azevedo@premierpet.com.br",
    role: "administrador",
    unit: "Matriz Dourado",
    status: "ativo",
  },
  {
    id: "conta-gestao-supply",
    name: "Equipe de Supply",
    email: "supply@premierpet.com.br",
    role: "gestor",
    unit: "Planejamento Logístico",
    status: "ativo",
  },
  {
    id: "conta-operacao-cd",
    name: "Logística Dourado",
    email: "logistica.dourado@premierpet.com.br",
    role: "operador",
    unit: "Complexo Industrial Dourado",
    status: "ativo",
  },
  {
    id: "conta-auditoria",
    name: "Auditoria Interna",
    email: "auditoria@premierpet.com.br",
    role: "consulta",
    unit: "Compliance Operacional",
    status: "ativo",
  },
] as const;

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

function isUserRole(value: unknown): value is UserRole {
  return value === "administrador" || value === "gestor" || value === "operador" || value === "consulta";
}

function isUserStatus(value: unknown): value is UserStatus {
  return value === "ativo" || value === "inativo";
}

export function getUserRoleLabel(role: UserRole, language?: LanguagePreference) {
  return USER_ROLE_COPY[resolveLanguage(language)][role].label;
}

export function loadUserAccounts() {
  const raw = window.localStorage.getItem(USER_ACCOUNTS_STORAGE_KEY);

  if (!raw) {
    return [...INITIAL_USER_ACCOUNTS];
  }

  const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;

  if (!Array.isArray(parsed)) {
    return [...INITIAL_USER_ACCOUNTS];
  }

  const accounts = parsed
    .map((item) => {
      if (
        typeof item.id !== "string" ||
        typeof item.name !== "string" ||
        typeof item.email !== "string" ||
        !isUserRole(item.role) ||
        typeof item.unit !== "string" ||
        !isUserStatus(item.status)
      ) {
        return null;
      }

      return {
        id: item.id,
        name: item.name,
        email: item.email,
        role: item.role,
        unit: item.unit,
        status: item.status,
      } satisfies UserAccount;
    })
    .filter((item): item is UserAccount => item !== null);

  return accounts.length > 0 ? accounts : [...INITIAL_USER_ACCOUNTS];
}

export function saveUserAccounts(accounts: UserAccount[]) {
  window.localStorage.setItem(USER_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
}

export function loadActiveUserAccountId() {
  const raw = window.localStorage.getItem(ACTIVE_USER_ACCOUNT_KEY);
  return typeof raw === "string" ? raw : null;
}

export function saveActiveUserAccountId(accountId: string | null) {
  if (accountId) {
    window.localStorage.setItem(ACTIVE_USER_ACCOUNT_KEY, accountId);
    return;
  }

  window.localStorage.removeItem(ACTIVE_USER_ACCOUNT_KEY);
}
