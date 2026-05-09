import { pathToFileURL } from "node:url";

import { readErpResource, writeErpResource } from "../lib/server/erp-state";
import {
  MIN_PASSWORD_LENGTH,
  upsertAuthCredential,
} from "../lib/server/auth-credentials";
import {
  normalizeUserAccount,
  normalizeUserAccounts,
  type UserAccount,
  type UserRole,
  type UserStatus,
} from "../lib/user-accounts";

const ALLOWED_ROLES = new Set<UserRole>([
  "administrador",
  "gestor",
  "operador",
  "consulta",
]);

const ALLOWED_STATUS = new Set<UserStatus>(["ativo", "inativo"]);

type DevelopmentSeedUser = {
  account: UserAccount;
  password: string;
};

function normalizeSeedAccount(account: UserAccount) {
  if (!ALLOWED_ROLES.has(account.role)) {
    throw new Error(`Role invalido no seed de desenvolvimento: ${account.role}.`);
  }

  if (!ALLOWED_STATUS.has(account.status)) {
    throw new Error(`Status invalido no seed de desenvolvimento: ${account.status}.`);
  }

  return normalizeUserAccount(account);
}

export const DEV_TEAM_SEED_USERS: readonly DevelopmentSeedUser[] = [
  {
    account: normalizeSeedAccount({
      id: "conta-dev-davi",
      name: "Davi",
      username: "davi",
      email: "davi@local.dev",
      role: "administrador",
      unit: "Desenvolvimento",
      status: "ativo",
    }),
    password: "Davi123!",
  },
  {
    account: normalizeSeedAccount({
      id: "conta-dev-lael",
      name: "Lael",
      username: "lael",
      email: "lael@local.dev",
      role: "administrador",
      unit: "Desenvolvimento",
      status: "ativo",
    }),
    password: "Lael123!",
  },
  {
    account: normalizeSeedAccount({
      id: "conta-dev-marcos",
      name: "Marcos",
      username: "marcos",
      email: "marcos@local.dev",
      role: "administrador",
      unit: "Desenvolvimento",
      status: "ativo",
    }),
    password: "Marcos123!",
  },
  {
    account: normalizeSeedAccount({
      id: "conta-dev-luiz",
      name: "Luiz",
      username: "luiz",
      email: "luiz@local.dev",
      role: "administrador",
      unit: "Desenvolvimento",
      status: "ativo",
    }),
    password: "Luiz123!",
  },
  {
    account: normalizeSeedAccount({
      id: "conta-dev-marco",
      name: "Marco",
      username: "marco",
      email: "marco@local.dev",
      role: "administrador",
      unit: "Desenvolvimento",
      status: "ativo",
    }),
    password: "Marco123!",
  },
] as const;

function buildNextAccounts(currentAccounts: UserAccount[]) {
  const reservedIds = new Set(DEV_TEAM_SEED_USERS.map(({ account }) => account.id));
  const reservedUsernames = new Set(DEV_TEAM_SEED_USERS.map(({ account }) => account.username));
  const reservedEmails = new Set(
    DEV_TEAM_SEED_USERS.map(({ account }) => account.email.toLowerCase()),
  );

  return normalizeUserAccounts([
    ...DEV_TEAM_SEED_USERS.map(({ account }) => account),
    ...currentAccounts.filter(
      (account) =>
        !reservedIds.has(account.id) &&
        !reservedUsernames.has(account.username) &&
        !reservedEmails.has(account.email.toLowerCase()),
    ),
  ]);
}

function listWeakSeedPasswords() {
  return DEV_TEAM_SEED_USERS.filter(({ password }) => password.length < MIN_PASSWORD_LENGTH).map(
    ({ account, password }) => `${account.username} (${password})`,
  );
}

export async function seedDevelopmentTeamUsers() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "O seed de desenvolvimento nao pode ser executado em producao.",
    );
  }

  const accountsResource = await readErpResource("user.accounts");
  const currentAccounts = normalizeUserAccounts(accountsResource.data);
  const nextAccounts = buildNextAccounts(currentAccounts);

  await writeErpResource("user.accounts", nextAccounts, {
    baseVersion: accountsResource.version,
  });

  for (const { account, password } of DEV_TEAM_SEED_USERS) {
    await upsertAuthCredential({
      accountId: account.id,
      username: account.username,
      password,
    });
  }

  const weakSeedPasswords = listWeakSeedPasswords();

  console.log(
    [
      "Contas temporarias de desenvolvimento provisionadas com sucesso.",
      "Essas contas existem apenas para validacao, testes e integracao da equipe em ambiente nao produtivo.",
      ...DEV_TEAM_SEED_USERS.map(
        ({ account, password }) =>
          `- ${account.name}: ${account.username} / ${password} (${account.role})`,
      ),
      weakSeedPasswords.length > 0
        ? `Aviso: ${weakSeedPasswords.join(", ")} ficam abaixo da politica padrao de ${MIN_PASSWORD_LENGTH} caracteres e so devem existir em desenvolvimento.`
        : null,
      "As contas foram salvas em user.accounts e nas credenciais do backend atual.",
    ].join("\n"),
  );
}

export async function seedDevUser() {
  await seedDevelopmentTeamUsers();
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  void seedDevelopmentTeamUsers().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Falha ao provisionar o seed de desenvolvimento.",
    );
    process.exitCode = 1;
  });
}
