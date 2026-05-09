import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadAuthCredentialsForAccounts } from "@/lib/server/auth-credentials";
import {
  authenticateServerUser,
  loadServerUserAccounts,
} from "@/lib/server/auth-session";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests,
} from "@/lib/server/firebase-admin";
import {
  DEV_TEAM_SEED_USERS,
  seedDevelopmentTeamUsers,
} from "../../scripts/seed-dev-user";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const ORIGINAL_ENV = { ...process.env };

function restoreProcessEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("development team seed", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "development";
    process.env.AUTH_SECRET =
      "0123456789abcdef0123456789abcdef0123456789abcdef";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("provisions the team accounts without duplication and keeps them authenticable", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    await seedDevelopmentTeamUsers();
    await seedDevelopmentTeamUsers();

    const accounts = await loadServerUserAccounts();
    const seededAccounts = DEV_TEAM_SEED_USERS.map(({ account }) => {
      const match = accounts.find((item) => item.id === account.id);
      assert.ok(match, `Conta ${account.id} nao encontrada.`);
      return match;
    });

    assert.equal(seededAccounts.length, DEV_TEAM_SEED_USERS.length);
    assert.equal(
      new Set(seededAccounts.map((account) => account.id)).size,
      DEV_TEAM_SEED_USERS.length,
    );
    assert.equal(
      new Set(seededAccounts.map((account) => account.username)).size,
      DEV_TEAM_SEED_USERS.length,
    );

    for (const account of seededAccounts) {
      assert.equal(account.role, "administrador");
      assert.equal(account.status, "ativo");
      assert.equal(account.unit, "Desenvolvimento");
    }

    const credentials = await loadAuthCredentialsForAccounts(accounts);

    for (const { account, password } of DEV_TEAM_SEED_USERS) {
      const credential = credentials[account.id];
      assert.ok(credential, `Credencial ${account.id} nao encontrada.`);
      assert.equal(credential.username, account.username);

      const authenticatedSession = await authenticateServerUser(
        account.username,
        password,
      );

      assert.ok(
        authenticatedSession,
        `Falha ao autenticar a conta ${account.username}.`,
      );
      assert.equal(authenticatedSession.account.id, account.id);
      assert.equal(authenticatedSession.role, "administrador");
    }
  });

  it("blocks the development seed in production", async () => {
    process.env.NODE_ENV = "production";

    await assert.rejects(
      () => seedDevelopmentTeamUsers(),
      /nao pode ser executado em producao/i,
    );
  });
});
