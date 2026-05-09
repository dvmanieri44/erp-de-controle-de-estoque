import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests,
} from "@/lib/server/firebase-admin";
import {
  createDocument,
  deleteDocument,
  DocumentConflictError,
  DocumentNotFoundError,
  getDocumentById,
  listDocuments,
  updateDocument,
} from "@/lib/server/documents";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const ORIGINAL_ENV = { ...process.env };

const SAMPLE_DOCUMENT = {
  title: "Laudo microbiologico itemizado",
  type: "Laudo",
  area: "Qualidade",
  updatedAt: "Hoje, 08:12",
  owner: "Tatiane Freitas",
};

const SAMPLE_SECOND_DOCUMENT = {
  title: "Comprovante de transferencia itemizado",
  type: "Comprovante",
  area: "Transferencias",
  updatedAt: "Ontem, 19:45",
  owner: "Joana Martins",
};

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

function seedLegacyDocumentsSnapshot(
  firestore: FakeFirestoreAdminDb,
  documents: unknown[],
  updatedAt = "2026-04-30T10:00:00.000Z",
) {
  firestore.seed("erpState", "operations.documents", {
    resource: "operations.documents",
    data: documents,
    updatedAt,
    version: 3,
  });
}

describe("documents item store", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "test";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("lists legacy snapshot documents with deterministic ids", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyDocumentsSnapshot(firestore, [SAMPLE_DOCUMENT]);

    const payload = await listDocuments();
    const document = payload.items[0];

    assert.equal(payload.count, 1);
    assert.ok(document);
    assert.match(document.id, /^doc_[a-f0-9]{16}$/);
    assert.equal(document.version, 1);
    assert.equal(document.versionUpdatedAt, "2026-04-30T10:00:00.000Z");
    assert.equal(document.updatedAt, SAMPLE_DOCUMENT.updatedAt);
    assert.equal((await getDocumentById(document.id)).title, SAMPLE_DOCUMENT.title);
    assert.equal(firestore.read("documents", document.id), null);
  });

  it("updates a legacy snapshot document through the itemized store without removing snapshot fallback", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyDocumentsSnapshot(firestore, [
      SAMPLE_DOCUMENT,
      SAMPLE_SECOND_DOCUMENT,
    ]);
    const legacyDocument = (await listDocuments()).items.find(
      (document) => document.title === SAMPLE_DOCUMENT.title,
    );

    assert.ok(legacyDocument);

    const updated = await updateDocument(
      legacyDocument.id,
      {
        owner: "Marina Azevedo",
        updatedAt: "Atualizado agora",
      },
      {
        baseVersion: 1,
      },
    );
    const loaded = await getDocumentById(legacyDocument.id);
    const payload = await listDocuments();

    assert.equal(updated.version, 2);
    assert.equal(updated.owner, "Marina Azevedo");
    assert.equal(updated.updatedAt, "Atualizado agora");
    assert.equal(loaded.version, 2);
    assert.equal(
      firestore.read("documents", legacyDocument.id)?.owner,
      "Marina Azevedo",
    );
    assert.equal(payload.count, 2);
    assert.equal(
      payload.items.find((document) => document.id === legacyDocument.id)
        ?.version,
      2,
    );
    assert.equal(
      payload.items.find(
        (document) => document.title === SAMPLE_SECOND_DOCUMENT.title,
      )?.version,
      1,
    );
  });

  it("creates a document directly in the item store with version 1", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createDocument(SAMPLE_DOCUMENT);
    const loaded = await getDocumentById(created.id);

    assert.match(created.id, /^doc_[a-f0-9]{16}$/);
    assert.equal(created.version, 1);
    assert.equal(loaded.version, 1);
    assert.equal(
      firestore.read("documents", created.id)?.title,
      SAMPLE_DOCUMENT.title,
    );
  });

  it("returns conflict when updating an itemized document with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("documents", "doc_manual", {
      ...SAMPLE_DOCUMENT,
      id: "doc_manual",
      versionUpdatedAt: "2026-04-30T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () =>
        updateDocument(
          "doc_manual",
          {
            owner: "Outra pessoa",
          },
          {
            baseVersion: 2,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof DocumentConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });

  it("rejects payloads that try to change the document id", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("documents", "doc_manual", {
      ...SAMPLE_DOCUMENT,
      id: "doc_manual",
      versionUpdatedAt: "2026-04-30T11:00:00.000Z",
      version: 1,
    });

    await assert.rejects(
      () =>
        updateDocument(
          "doc_manual",
          {
            id: "doc_outro",
          },
          {
            baseVersion: 1,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof ErpResourceValidationError);
        assert.match(error.message, /id da rota/i);
        return true;
      },
    );
  });

  it("deletes a legacy snapshot document through a tombstone without reappearing in hybrid reads", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyDocumentsSnapshot(firestore, [
      SAMPLE_DOCUMENT,
      SAMPLE_SECOND_DOCUMENT,
    ]);
    const legacyDocument = (await listDocuments()).items.find(
      (document) => document.title === SAMPLE_DOCUMENT.title,
    );

    assert.ok(legacyDocument);

    const deleted = await deleteDocument(legacyDocument.id, 1);
    const payload = await listDocuments();

    assert.equal(deleted.id, legacyDocument.id);
    assert.equal(deleted.version, 2);
    assert.equal(firestore.read("documents", legacyDocument.id)?.deleted, true);
    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.title, SAMPLE_SECOND_DOCUMENT.title);
    await assert.rejects(
      () => getDocumentById(legacyDocument.id),
      DocumentNotFoundError,
    );
  });

  it("returns conflict when deleting a document with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("documents", "doc_manual", {
      ...SAMPLE_DOCUMENT,
      id: "doc_manual",
      versionUpdatedAt: "2026-04-30T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () => deleteDocument("doc_manual", 2),
      (error: unknown) => {
        assert.ok(error instanceof DocumentConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });
});
