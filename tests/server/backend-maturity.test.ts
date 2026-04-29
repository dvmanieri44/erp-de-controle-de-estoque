import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { NextResponse } from "next/server";

import {
  DELETE as deleteErpStateResourceRoute,
  PATCH as patchErpStateResourceRoute,
  POST as postErpStateResourceRoute,
  PUT as putErpStateResourceRoute,
} from "@/app/api/erp/state/[resource]/route";
import { INITIAL_LOCATIONS } from "@/lib/inventory";
import { PRODUCT_LINES } from "@/lib/operations-data";
import { assertCanWriteErpResource } from "@/lib/server/erp-access-control";
import {
  loadAuthCredentialsForAccounts,
  upsertAuthCredential,
} from "@/lib/server/auth-credentials";
import {
  loadServerUserAccounts,
  setServerSessionCookie,
} from "@/lib/server/auth-session";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests,
  setFirebaseConfiguredForTests,
} from "@/lib/server/firebase-admin";
import {
  ErpResourceConflictError,
  readErpResource,
  writeErpResource,
} from "@/lib/server/erp-state";
import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import { requestPasswordReset } from "@/lib/server/password-reset";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";
import type { UserAccount } from "@/lib/user-accounts";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const SAMPLE_ADMIN_ACCOUNT: UserAccount = {
  id: "conta-admin-premierpet",
  name: "Joao Pedro Chiavoloni",
  username: "admin",
  email: "admin@premierpet.com.br",
  role: "administrador",
  unit: "Matriz Dourado",
  status: "ativo",
};

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

describe("backend maturity", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "test";
    process.env.AUTH_SECRET =
      "0123456789abcdef0123456789abcdef0123456789abcdef";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("blocks writes for roles without permission", () => {
    assert.throws(
      () =>
        assertCanWriteErpResource(
          {
            account: SAMPLE_ADMIN_ACCOUNT,
            username: "consulta",
            role: "consulta",
            expiresAt: Date.now() + 60_000,
          },
          "inventory.movements",
        ),
      /nao pode alterar/i,
    );
  });

  it("rejects invalid payloads before persistence", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    await assert.rejects(
      () =>
        writeErpResource(
          "inventory.locations",
          [
            {
              id: "localizacao-invalida",
              name: "Localizacao invalida",
            },
          ] as never,
          { baseVersion: 0 },
        ),
      (error) => error instanceof ErpResourceValidationError,
    );
  });

  it("returns a 409 conflict when baseVersion is stale", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    await writeErpResource(
      "inventory.locations",
      [
        {
              id: "cd-sudeste",
              name: "CD Sudeste",
              type: INITIAL_LOCATIONS[1]!.type,
              address: "Jundiai - SP",
              manager: "Carlos Menezes",
              capacityTotal: 1000,
              status: INITIAL_LOCATIONS[0]!.status,
            },
          ],
          { baseVersion: 0 },
    );

    await assert.rejects(
      () =>
        writeErpResource(
          "inventory.locations",
          [
            {
              id: "cd-sudeste",
              name: "CD Sudeste Atualizado",
              type: INITIAL_LOCATIONS[1]!.type,
              address: "Jundiai - SP",
              manager: "Carlos Menezes",
              capacityTotal: 1200,
              status: INITIAL_LOCATIONS[0]!.status,
            },
          ],
          { baseVersion: 0 },
        ),
      (error) =>
        error instanceof ErpResourceConflictError && error.status === 409,
    );
  });

  it("blocks generic writes for inventory movements in favor of dedicated routes", async () => {
    const context = {
      params: Promise.resolve({
        resource: "inventory.movements",
      }),
    };
    const expectedPayload = {
      error:
        "As movimentacoes devem ser alteradas apenas pelas rotas dedicadas /api/erp/movements e /api/erp/movements/[movementId].",
    };

    const putResponse = await putErpStateResourceRoute(
      new Request("http://localhost/api/erp/state/inventory.movements", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: [],
          baseVersion: 0,
        }),
      }),
      context,
    );
    assert.equal(putResponse.status, 403);
    assert.deepEqual(await putResponse.json(), expectedPayload);

    for (const [method, handler] of [
      ["POST", postErpStateResourceRoute],
      ["PATCH", patchErpStateResourceRoute],
      ["DELETE", deleteErpStateResourceRoute],
    ] as const) {
      const response = await handler(
        new Request("http://localhost/api/erp/state/inventory.movements", {
          method,
        }),
        context,
      );

      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), expectedPayload);
    }
  });

  it("blocks generic writes for operations lots in favor of dedicated routes", async () => {
    const context = {
      params: Promise.resolve({
        resource: "operations.lots",
      }),
    };
    const expectedPayload = {
      error:
        "Os lotes devem ser alterados apenas pelas rotas dedicadas /api/erp/lots e /api/erp/lots/[lotCode].",
    };

    const putResponse = await putErpStateResourceRoute(
      new Request("http://localhost/api/erp/state/operations.lots", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: [],
          baseVersion: 0,
        }),
      }),
      context,
    );
    assert.equal(putResponse.status, 403);
    assert.deepEqual(await putResponse.json(), expectedPayload);

    for (const [method, handler] of [
      ["POST", postErpStateResourceRoute],
      ["PATCH", patchErpStateResourceRoute],
      ["DELETE", deleteErpStateResourceRoute],
    ] as const) {
      const response = await handler(
        new Request("http://localhost/api/erp/state/operations.lots", {
          method,
        }),
        context,
      );

      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), expectedPayload);
    }
  });

  it("blocks generic writes for inventory locations in favor of dedicated routes", async () => {
    const context = {
      params: Promise.resolve({
        resource: "inventory.locations",
      }),
    };
    const expectedPayload = {
      error:
        "As localizacoes devem ser alteradas apenas pelas rotas dedicadas /api/erp/locations e /api/erp/locations/[locationId].",
    };

    const putResponse = await putErpStateResourceRoute(
      new Request("http://localhost/api/erp/state/inventory.locations", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: [],
          baseVersion: 0,
        }),
      }),
      context,
    );
    assert.equal(putResponse.status, 403);
    assert.deepEqual(await putResponse.json(), expectedPayload);

    for (const [method, handler] of [
      ["POST", postErpStateResourceRoute],
      ["PATCH", patchErpStateResourceRoute],
      ["DELETE", deleteErpStateResourceRoute],
    ] as const) {
      const response = await handler(
        new Request("http://localhost/api/erp/state/inventory.locations", {
          method,
        }),
        context,
      );

      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), expectedPayload);
    }
  });

  it("blocks generic writes for operations products in favor of dedicated routes", async () => {
    const context = {
      params: Promise.resolve({
        resource: "operations.products",
      }),
    };
    const expectedPayload = {
      error:
        "Os produtos devem ser alterados apenas pelas rotas dedicadas /api/erp/products e /api/erp/products/[sku].",
    };

    const putResponse = await putErpStateResourceRoute(
      new Request("http://localhost/api/erp/state/operations.products", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: [],
          baseVersion: 0,
        }),
      }),
      context,
    );
    assert.equal(putResponse.status, 403);
    assert.deepEqual(await putResponse.json(), expectedPayload);

    for (const [method, handler] of [
      ["POST", postErpStateResourceRoute],
      ["PATCH", patchErpStateResourceRoute],
      ["DELETE", deleteErpStateResourceRoute],
    ] as const) {
      const response = await handler(
        new Request("http://localhost/api/erp/state/operations.products", {
          method,
        }),
        context,
      );

      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), expectedPayload);
    }
  });

  it("reads and writes ERP resources through the Firestore path", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const writePayload = await writeErpResource(
      "operations.products",
      [
        {
          sku: "PF-AD-MINI-25",
          product: "PremieR Formula Caes Adultos Porte Mini",
          line: "PremieR Formula",
          species: PRODUCT_LINES[1]!.species,
          stage: "Adulto",
          package: "2,5 kg",
          stock: 100,
          target: 150,
          coverageDays: 10,
          status: PRODUCT_LINES[0]!.status,
        },
      ],
      { baseVersion: 0 },
    );

    assert.equal(writePayload.version, 1);

    const readPayload = await readErpResource("operations.products");
    assert.equal(readPayload.version, 1);
    assert.equal(readPayload.exists, true);
    assert.equal(readPayload.data[0]?.sku, "PF-AD-MINI-25");
  });

  it("reads user accounts and auth credentials from Firestore", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    await writeErpResource("user.accounts", [SAMPLE_ADMIN_ACCOUNT], {
      baseVersion: 0,
    });
    await upsertAuthCredential({
      accountId: SAMPLE_ADMIN_ACCOUNT.id,
      username: SAMPLE_ADMIN_ACCOUNT.username,
      password: "senha-forte-123",
    });

    const accounts = await loadServerUserAccounts();
    const credentials = await loadAuthCredentialsForAccounts(accounts);

    assert.equal(accounts.length, 1);
    assert.equal(accounts[0]?.username, SAMPLE_ADMIN_ACCOUNT.username);
    assert.equal(
      credentials[SAMPLE_ADMIN_ACCOUNT.id]?.username,
      SAMPLE_ADMIN_ACCOUNT.username,
    );
  });

  it("requires AUTH_SECRET in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_SECRET;

    assert.throws(
      () =>
        setServerSessionCookie(NextResponse.json({ ok: true }), {
          account: SAMPLE_ADMIN_ACCOUNT,
          username: SAMPLE_ADMIN_ACCOUNT.username,
          role: SAMPLE_ADMIN_ACCOUNT.role,
        }),
      /AUTH_SECRET obrigatorio em producao/i,
    );
  });

  it("does not bootstrap dev credentials without explicit flags", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_BOOTSTRAP_PASSWORDS = "false";
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;

    const credentials = await loadAuthCredentialsForAccounts([
      SAMPLE_ADMIN_ACCOUNT,
    ]);

    assert.deepEqual(credentials, {});
  });

  it("does not expose debug reset links without explicit flags", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    process.env.NODE_ENV = "development";
    delete process.env.ENABLE_DEBUG_RESET_LINKS;

    await writeErpResource("user.accounts", [SAMPLE_ADMIN_ACCOUNT], {
      baseVersion: 0,
    });

    const resetRequest = await requestPasswordReset("admin", {
      ip: "127.0.0.1",
      userAgent: "node:test",
      path: "/login",
      method: "POST",
    });

    assert.equal(resetRequest.debugResetUrl, undefined);
  });

  it("requires firebase persistence in production", () => {
    process.env.NODE_ENV = "production";
    setFirebaseAdminDbForTests(null);
    setFirebaseConfiguredForTests(false);

    assert.throws(
      () => getServerPersistenceProvider("erp"),
      /Firebase Admin obrigatorio em producao/i,
    );
  });
});
