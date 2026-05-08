import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createQualityEvent,
  deleteQualityEvent,
  getQualityEventById,
  listQualityEvents,
  QualityEventConflictError,
  QualityEventNotFoundError,
  updateQualityEvent,
} from "@/lib/server/quality-events";
import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests,
} from "@/lib/server/firebase-admin";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const ORIGINAL_ENV = { ...process.env };

const SAMPLE_EVENT = {
  title: "Parecer de qualidade itemizado",
  lot: "LOT-QE-001",
  area: "Laboratorio central",
  owner: "Luciana Prado",
  status: "Liberado" as const,
};

const SAMPLE_SECOND_EVENT = {
  title: "Reanalise de umidade",
  lot: "LOT-QE-002",
  area: "Quality Hold",
  owner: "Tatiane Freitas",
  status: "Desvio" as const,
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

function seedLegacyQualityEventsSnapshot(
  firestore: FakeFirestoreAdminDb,
  events: unknown[],
  updatedAt = "2026-04-29T10:00:00.000Z",
) {
  firestore.seed("erpState", "operations.quality-events", {
    resource: "operations.quality-events",
    data: events,
    updatedAt,
    version: 3,
  });
}

describe("quality events item store", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "test";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("lists legacy snapshot quality events with deterministic ids", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyQualityEventsSnapshot(firestore, [SAMPLE_EVENT]);

    const payload = await listQualityEvents();
    const event = payload.items[0];

    assert.equal(payload.count, 1);
    assert.ok(event);
    assert.match(event.id, /^qe_[a-f0-9]{16}$/);
    assert.equal(event.version, 1);
    assert.equal(event.updatedAt, "2026-04-29T10:00:00.000Z");
    assert.equal((await getQualityEventById(event.id)).title, SAMPLE_EVENT.title);
    assert.equal(firestore.read("qualityEvents", event.id), null);
  });

  it("updates a legacy snapshot event through the itemized store without removing snapshot fallback", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyQualityEventsSnapshot(firestore, [
      SAMPLE_EVENT,
      SAMPLE_SECOND_EVENT,
    ]);
    const legacyEvent = (await listQualityEvents()).items.find(
      (event) => event.title === SAMPLE_EVENT.title,
    );

    assert.ok(legacyEvent);

    const updated = await updateQualityEvent(
      legacyEvent.id,
      {
        owner: "Marina Azevedo",
        status: "Desvio",
      },
      {
        baseVersion: 1,
      },
    );
    const loaded = await getQualityEventById(legacyEvent.id);
    const payload = await listQualityEvents();

    assert.equal(updated.version, 2);
    assert.equal(updated.owner, "Marina Azevedo");
    assert.equal(updated.status, "Desvio");
    assert.equal(loaded.version, 2);
    assert.equal(
      firestore.read("qualityEvents", legacyEvent.id)?.owner,
      "Marina Azevedo",
    );
    assert.equal(payload.count, 2);
    assert.equal(
      payload.items.find((event) => event.id === legacyEvent.id)?.version,
      2,
    );
    assert.equal(
      payload.items.find((event) => event.title === SAMPLE_SECOND_EVENT.title)
        ?.version,
      1,
    );
  });

  it("creates a quality event directly in the item store with version 1", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createQualityEvent(SAMPLE_EVENT);
    const loaded = await getQualityEventById(created.id);

    assert.match(created.id, /^qe_[a-f0-9]{16}$/);
    assert.equal(created.version, 1);
    assert.equal(loaded.version, 1);
    assert.equal(
      firestore.read("qualityEvents", created.id)?.title,
      SAMPLE_EVENT.title,
    );
  });

  it("returns conflict when updating an itemized quality event with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("qualityEvents", "qe_manual", {
      ...SAMPLE_EVENT,
      id: "qe_manual",
      updatedAt: "2026-04-29T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () =>
        updateQualityEvent(
          "qe_manual",
          {
            owner: "Outra pessoa",
          },
          {
            baseVersion: 2,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof QualityEventConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });

  it("rejects payloads that try to change the quality event id", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("qualityEvents", "qe_manual", {
      ...SAMPLE_EVENT,
      id: "qe_manual",
      updatedAt: "2026-04-29T11:00:00.000Z",
      version: 1,
    });

    await assert.rejects(
      () =>
        updateQualityEvent(
          "qe_manual",
          {
            id: "qe_outro",
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

  it("deletes a legacy snapshot quality event through a tombstone without reappearing in hybrid reads", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyQualityEventsSnapshot(firestore, [
      SAMPLE_EVENT,
      SAMPLE_SECOND_EVENT,
    ]);
    const legacyEvent = (await listQualityEvents()).items.find(
      (event) => event.title === SAMPLE_EVENT.title,
    );

    assert.ok(legacyEvent);

    const deleted = await deleteQualityEvent(legacyEvent.id, 1);
    const payload = await listQualityEvents();

    assert.equal(deleted.id, legacyEvent.id);
    assert.equal(deleted.version, 2);
    assert.equal(
      firestore.read("qualityEvents", legacyEvent.id)?.deleted,
      true,
    );
    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.title, SAMPLE_SECOND_EVENT.title);
    await assert.rejects(
      () => getQualityEventById(legacyEvent.id),
      QualityEventNotFoundError,
    );
  });

  it("returns conflict when deleting a quality event with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("qualityEvents", "qe_manual", {
      ...SAMPLE_EVENT,
      id: "qe_manual",
      updatedAt: "2026-04-29T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () => deleteQualityEvent("qe_manual", 2),
      (error: unknown) => {
        assert.ok(error instanceof QualityEventConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });
});
