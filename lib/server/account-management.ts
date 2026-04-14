import "server-only";

import {
  createUserAccountId,
  normalizeLoginUsername,
  normalizeUserAccount,
  normalizeUserAccounts,
  type UserAccount,
  type UserRole,
  type UserStatus,
} from "@/lib/user-accounts";
import { loadServerUserAccounts, type ServerSession, verifyServerSessionPassword } from "@/lib/server/auth-session";
import {
  deleteAuthCredential,
  loadAuthCredentialsForAccounts,
  MIN_PASSWORD_LENGTH,
  renameAuthCredentialUsername,
  upsertAuthCredential,
} from "@/lib/server/auth-credentials";
import { writeErpResource } from "@/lib/server/erp-state";

export type AccountMutationInput = {
  name: string;
  username: string;
  email: string;
  role: UserRole;
  unit: string;
  status: UserStatus;
};

export class AccountManagementError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function isUserRole(value: unknown): value is UserRole {
  return value === "administrador" || value === "gestor" || value === "operador" || value === "consulta";
}

function isUserStatus(value: unknown): value is UserStatus {
  return value === "ativo" || value === "inativo";
}

function roleLevel(role: UserRole) {
  if (role === "administrador") return 4;
  if (role === "gestor") return 3;
  if (role === "operador") return 2;
  return 1;
}

function canViewAllAccounts(session: ServerSession) {
  return roleLevel(session.role) >= roleLevel("gestor");
}

function canManageAccount(session: ServerSession, account: UserAccount) {
  if (session.role === "administrador") {
    return true;
  }

  return roleLevel(account.role) < roleLevel(session.role);
}

function validateManagerSession(session: ServerSession) {
  if (!canViewAllAccounts(session)) {
    throw new AccountManagementError("Sua conta nao tem permissao para gerenciar outros perfis.", 403);
  }
}

async function validateCurrentPassword(currentPassword: string) {
  if (!currentPassword.trim()) {
    throw new AccountManagementError("Informe sua senha atual para continuar.", 400);
  }

  const valid = await verifyServerSessionPassword(currentPassword);

  if (!valid) {
    throw new AccountManagementError("Senha atual invalida.", 401);
  }
}

function normalizeAccountInput(input: AccountMutationInput) {
  const name = input.name.trim();
  const username = normalizeLoginUsername(input.username);
  const email = input.email.trim().toLowerCase();
  const unit = input.unit.trim();

  if (!name || !username || !email || !unit) {
    throw new AccountManagementError("Preencha nome, usuario, e-mail e unidade.", 400);
  }

  if (!email.includes("@")) {
    throw new AccountManagementError("Informe um e-mail valido para a conta.", 400);
  }

  if (!isUserRole(input.role) || !isUserStatus(input.status)) {
    throw new AccountManagementError("Dados de perfil invalidos para a conta.", 400);
  }

  return {
    name,
    username,
    email,
    role: input.role,
    unit,
    status: input.status,
  } satisfies AccountMutationInput;
}

function ensureUniqueAccountFields(accounts: UserAccount[], account: AccountMutationInput, excludeAccountId?: string) {
  if (
    accounts.some(
      (item) => item.id !== excludeAccountId && item.email.toLowerCase() === account.email.toLowerCase(),
    )
  ) {
    throw new AccountManagementError("Ja existe uma conta com esse e-mail.", 400);
  }

  if (
    accounts.some(
      (item) => item.id !== excludeAccountId && item.username.toLowerCase() === account.username.toLowerCase(),
    )
  ) {
    throw new AccountManagementError("Ja existe uma conta com esse usuario de acesso.", 400);
  }
}

function buildUniqueAccountId(accounts: UserAccount[], input: AccountMutationInput) {
  const baseId =
    createUserAccountId(input.name) ||
    createUserAccountId(input.username) ||
    `conta-${Date.now()}`;

  if (!accounts.some((account) => account.id === baseId)) {
    return baseId;
  }

  let suffix = 2;

  while (accounts.some((account) => account.id === `${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

function getVisibleAccountsForSession(session: ServerSession, accounts: UserAccount[]) {
  if (canViewAllAccounts(session)) {
    return normalizeUserAccounts(accounts);
  }

  return normalizeUserAccounts(accounts.filter((account) => account.id === session.account.id));
}

function ensureRoleEscalationAllowed(session: ServerSession, targetRole: UserRole) {
  if (session.role !== "administrador" && roleLevel(targetRole) >= roleLevel(session.role)) {
    throw new AccountManagementError("Seu perfil nao pode criar ou promover essa credencial.", 403);
  }
}

export function parseAccountMutationInput(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<Record<keyof AccountMutationInput, unknown>>;

  if (
    typeof candidate.name !== "string" ||
    typeof candidate.username !== "string" ||
    typeof candidate.email !== "string" ||
    !isUserRole(candidate.role) ||
    typeof candidate.unit !== "string" ||
    !isUserStatus(candidate.status)
  ) {
    return null;
  }

  return {
    name: candidate.name,
    username: candidate.username,
    email: candidate.email,
    role: candidate.role,
    unit: candidate.unit,
    status: candidate.status,
  } satisfies AccountMutationInput;
}

export async function listVisibleAccounts(session: ServerSession) {
  const accounts = await loadServerUserAccounts();
  await loadAuthCredentialsForAccounts(accounts);
  return {
    accounts: getVisibleAccountsForSession(session, accounts),
  };
}

export async function createManagedAccount(input: {
  session: ServerSession;
  currentPassword: string;
  account: AccountMutationInput;
  password: string;
}) {
  validateManagerSession(input.session);
  await validateCurrentPassword(input.currentPassword);

  const accounts = await loadServerUserAccounts();
  const nextAccountInput = normalizeAccountInput(input.account);
  ensureRoleEscalationAllowed(input.session, nextAccountInput.role);
  ensureUniqueAccountFields(accounts, nextAccountInput);

  if (input.password.trim().length < MIN_PASSWORD_LENGTH) {
    throw new AccountManagementError(
      `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      400,
    );
  }

  const nextAccount = normalizeUserAccount({
    id: buildUniqueAccountId(accounts, nextAccountInput),
    ...nextAccountInput,
  });
  const nextAccounts = normalizeUserAccounts([nextAccount, ...accounts]);

  await writeErpResource("user.accounts", nextAccounts);
  await upsertAuthCredential({
    accountId: nextAccount.id,
    username: nextAccount.username,
    password: input.password,
  });

  return {
    accounts: getVisibleAccountsForSession(input.session, nextAccounts),
    account: nextAccount,
  };
}

export async function updateManagedAccount(input: {
  session: ServerSession;
  accountId: string;
  currentPassword: string;
  account: AccountMutationInput;
  password?: string;
}) {
  validateManagerSession(input.session);
  await validateCurrentPassword(input.currentPassword);

  const accounts = await loadServerUserAccounts();
  const existingAccount = accounts.find((account) => account.id === input.accountId) ?? null;

  if (!existingAccount) {
    throw new AccountManagementError("Conta nao encontrada.", 404);
  }

  if (!canManageAccount(input.session, existingAccount)) {
    throw new AccountManagementError("Sua conta nao pode editar esse perfil.", 403);
  }

  const nextAccountInput = normalizeAccountInput(input.account);
  ensureRoleEscalationAllowed(input.session, nextAccountInput.role);

  if (existingAccount.id === input.session.account.id) {
    if (nextAccountInput.username !== existingAccount.username) {
      throw new AccountManagementError(
        "Para sua propria conta, mantenha o mesmo usuario de acesso e altere depois em um fluxo dedicado.",
        400,
      );
    }

    if (nextAccountInput.role !== existingAccount.role || nextAccountInput.status !== "ativo") {
      throw new AccountManagementError("Voce nao pode desativar ou mudar o proprio perfil atual.", 400);
    }
  }

  ensureUniqueAccountFields(accounts, nextAccountInput, existingAccount.id);

  const trimmedPassword = input.password?.trim() ?? "";

  if (trimmedPassword.length > 0 && trimmedPassword.length < MIN_PASSWORD_LENGTH) {
    throw new AccountManagementError(
      `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      400,
    );
  }

  const credentials = await loadAuthCredentialsForAccounts(accounts);
  const existingCredential = credentials[existingAccount.id] ?? null;

  if (trimmedPassword.length === 0 && !existingCredential) {
    throw new AccountManagementError(
      "Defina uma senha para habilitar o acesso dessa conta no primeiro ajuste.",
      400,
    );
  }

  const nextAccount = normalizeUserAccount({
    id: existingAccount.id,
    ...nextAccountInput,
  });
  const nextAccounts = normalizeUserAccounts(
    accounts.map((account) => (account.id === existingAccount.id ? nextAccount : account)),
  );

  await writeErpResource("user.accounts", nextAccounts);

  if (trimmedPassword.length > 0) {
    await upsertAuthCredential({
      accountId: nextAccount.id,
      username: nextAccount.username,
      password: trimmedPassword,
    });
  } else if (existingCredential) {
    await renameAuthCredentialUsername({
      accountId: nextAccount.id,
      username: nextAccount.username,
    });
  }

  return {
    accounts: getVisibleAccountsForSession(input.session, nextAccounts),
    account: nextAccount,
  };
}

export async function deleteManagedAccount(input: {
  session: ServerSession;
  accountId: string;
  currentPassword: string;
}) {
  validateManagerSession(input.session);
  await validateCurrentPassword(input.currentPassword);

  const accounts = await loadServerUserAccounts();
  const existingAccount = accounts.find((account) => account.id === input.accountId) ?? null;

  if (!existingAccount) {
    throw new AccountManagementError("Conta nao encontrada.", 404);
  }

  if (existingAccount.id === input.session.account.id) {
    throw new AccountManagementError("Troque a conta ativa antes de excluir.", 400);
  }

  if (!canManageAccount(input.session, existingAccount)) {
    throw new AccountManagementError("Sua conta nao pode excluir esse perfil.", 403);
  }

  const activeAdministrators = accounts.filter(
    (account) => account.role === "administrador" && account.status === "ativo",
  );

  if (existingAccount.role === "administrador" && activeAdministrators.length <= 1) {
    throw new AccountManagementError("Mantenha pelo menos um administrador ativo no sistema.", 400);
  }

  const nextAccounts = normalizeUserAccounts(accounts.filter((account) => account.id !== existingAccount.id));

  await writeErpResource("user.accounts", nextAccounts);
  await deleteAuthCredential(existingAccount.id);

  return {
    accounts: getVisibleAccountsForSession(input.session, nextAccounts),
  };
}
