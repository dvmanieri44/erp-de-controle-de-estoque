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

export const USER_ROLE_OPTIONS: Array<{ value: UserRole; label: string; helper: string }> = [
  { value: "administrador", label: "Administrador", helper: "Acesso total ao sistema e às configurações" },
  { value: "gestor", label: "Gestor", helper: "Acompanha operação e gerencia áreas da unidade" },
  { value: "operador", label: "Operador", helper: "Registra movimentações e acompanha execuções" },
  { value: "consulta", label: "Consulta", helper: "Visualiza informações sem editar dados críticos" },
];

export const USER_STATUS_OPTIONS: Array<{ value: UserStatus; label: string }> = [
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" },
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

export function getUserRoleLabel(role: UserRole) {
  return USER_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? "Operador";
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
