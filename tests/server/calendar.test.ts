import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { CALENDAR_TYPE_OPTIONS } from "@/lib/operations-data";
import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import {
  CalendarConflictError,
  CalendarNotFoundError,
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEventById,
  listCalendarEvents,
  updateCalendarEvent,
} from "@/lib/server/calendar";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests,
} from "@/lib/server/firebase-admin";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const ORIGINAL_ENV = { ...process.env };

const SAMPLE_CALENDAR_EVENT = {
  title: "Janela de carregamento do CD Sudeste",
  slot: "Hoje, 18:00",
  area: "Expedicao Dourado",
  type: CALENDAR_TYPE_OPTIONS[0],
};

const SAMPLE_SECOND_CALENDAR_EVENT = {
  title: "Inspecao da linha umida",
  slot: "Amanha, 08:00",
  area: "Qualidade",
  type: CALENDAR_TYPE_OPTIONS[1],
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

function seedLegacyCalendarSnapshot(
  firestore: FakeFirestoreAdminDb,
  items: unknown[],
  updatedAt = "2026-05-02T10:00:00.000Z",
) {
  firestore.seed("erpState", "operations.calendar", {
    resource: "operations.calendar",
    data: items,
    updatedAt,
    version: 3,
  });
}

describe("calendar item store", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "test";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("lists legacy snapshot calendar events with deterministic ids", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyCalendarSnapshot(firestore, [SAMPLE_CALENDAR_EVENT]);

    const payload = await listCalendarEvents();
    const item = payload.items[0];

    assert.equal(payload.count, 1);
    assert.ok(item);
    assert.match(item.id, /^calendar_[a-f0-9]{16}$/);
    assert.equal(item.version, 1);
    assert.equal(item.updatedAt, "2026-05-02T10:00:00.000Z");
    assert.equal(
      (await getCalendarEventById(item.id)).title,
      SAMPLE_CALENDAR_EVENT.title,
    );
    assert.equal(firestore.read("calendar", item.id), null);
  });

  it("updates a legacy snapshot calendar event through the itemized store without removing snapshot fallback", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyCalendarSnapshot(firestore, [
      SAMPLE_CALENDAR_EVENT,
      SAMPLE_SECOND_CALENDAR_EVENT,
    ]);
    const legacyEvent = (await listCalendarEvents()).items.find(
      (item) => item.title === SAMPLE_CALENDAR_EVENT.title,
    );

    assert.ok(legacyEvent);

    const updated = await updateCalendarEvent(
      legacyEvent.id,
      {
        slot: "Hoje, 19:00",
      },
      {
        baseVersion: 1,
      },
    );
    const loaded = await getCalendarEventById(legacyEvent.id);
    const payload = await listCalendarEvents();

    assert.equal(updated.version, 2);
    assert.equal(updated.slot, "Hoje, 19:00");
    assert.equal(loaded.version, 2);
    assert.equal(firestore.read("calendar", legacyEvent.id)?.slot, "Hoje, 19:00");
    assert.equal(payload.count, 2);
    assert.equal(
      payload.items.find((item) => item.id === legacyEvent.id)?.version,
      2,
    );
  });

  it("creates a calendar event directly in the item store with version 1", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createCalendarEvent(SAMPLE_CALENDAR_EVENT);
    const loaded = await getCalendarEventById(created.id);

    assert.match(created.id, /^calendar_[a-f0-9]{16}$/);
    assert.equal(created.version, 1);
    assert.equal(loaded.version, 1);
    assert.equal(
      firestore.read("calendar", created.id)?.title,
      SAMPLE_CALENDAR_EVENT.title,
    );
  });

  it("rejects create when another calendar event already uses the same title", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyCalendarSnapshot(firestore, [SAMPLE_CALENDAR_EVENT]);

    await assert.rejects(
      () =>
        createCalendarEvent({
          ...SAMPLE_SECOND_CALENDAR_EVENT,
          title: SAMPLE_CALENDAR_EVENT.title,
        }),
      (error: unknown) => {
        assert.ok(error instanceof ErpResourceValidationError);
        assert.match(error.message, /ja existe um evento com esse titulo/i);
        return true;
      },
    );
  });

  it("returns conflict when updating an itemized calendar event with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("calendar", "calendar_manual", {
      ...SAMPLE_CALENDAR_EVENT,
      id: "calendar_manual",
      updatedAt: "2026-05-02T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () =>
        updateCalendarEvent(
          "calendar_manual",
          {
            area: "Expedicao Norte",
          },
          {
            baseVersion: 2,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof CalendarConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });

  it("rejects payloads that try to change the calendar event id", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("calendar", "calendar_manual", {
      ...SAMPLE_CALENDAR_EVENT,
      id: "calendar_manual",
      updatedAt: "2026-05-02T11:00:00.000Z",
      version: 1,
    });

    await assert.rejects(
      () =>
        updateCalendarEvent(
          "calendar_manual",
          {
            id: "calendar_other",
          },
          {
            baseVersion: 1,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof ErpResourceValidationError);
        assert.match(
          error.message,
          /id do evento do calendario precisa corresponder/i,
        );
        return true;
      },
    );
  });

  it("deletes a legacy snapshot calendar event through a tombstone without reappearing in hybrid reads", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyCalendarSnapshot(firestore, [
      SAMPLE_CALENDAR_EVENT,
      SAMPLE_SECOND_CALENDAR_EVENT,
    ]);
    const legacyEvent = (await listCalendarEvents()).items.find(
      (item) => item.title === SAMPLE_CALENDAR_EVENT.title,
    );

    assert.ok(legacyEvent);

    const deleted = await deleteCalendarEvent(legacyEvent.id, 1);
    const payload = await listCalendarEvents();

    assert.equal(deleted.id, legacyEvent.id);
    assert.equal(deleted.version, 2);
    assert.equal(firestore.read("calendar", legacyEvent.id)?.deleted, true);
    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.title, SAMPLE_SECOND_CALENDAR_EVENT.title);
    await assert.rejects(
      () => getCalendarEventById(legacyEvent.id),
      CalendarNotFoundError,
    );
  });

  it("returns conflict when deleting a calendar event with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("calendar", "calendar_manual", {
      ...SAMPLE_CALENDAR_EVENT,
      id: "calendar_manual",
      updatedAt: "2026-05-02T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () => deleteCalendarEvent("calendar_manual", 2),
      (error: unknown) => {
        assert.ok(error instanceof CalendarConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });
});
