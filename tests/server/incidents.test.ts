import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests,
} from "@/lib/server/firebase-admin";
import {
  createIncident,
  deleteIncident,
  getIncidentById,
  IncidentConflictError,
  IncidentNotFoundError,
  listIncidents,
  updateIncident,
} from "@/lib/server/incidents";
import { INCIDENTS } from "@/lib/operations-data";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const ORIGINAL_ENV = { ...process.env };

const SAMPLE_INCIDENT = {
  title: "Avaria em pallet itemizado",
  area: "Expedicao Dourado",
  severity: INCIDENTS[0]!.severity,
  owner: "Fernanda Rocha",
  status: INCIDENTS[0]!.status,
};

const SAMPLE_SECOND_INCIDENT = {
  title: "Atraso de coleta itemizado",
  area: "Transporte",
  severity: INCIDENTS[2]!.severity,
  owner: "LogPrime Transportes",
  status: INCIDENTS[1]!.status,
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

function seedLegacyIncidentsSnapshot(
  firestore: FakeFirestoreAdminDb,
  incidents: unknown[],
  updatedAt = "2026-04-30T10:00:00.000Z",
) {
  firestore.seed("erpState", "operations.incidents", {
    resource: "operations.incidents",
    data: incidents,
    updatedAt,
    version: 3,
  });
}

describe("incidents item store", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "test";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("lists legacy snapshot incidents with deterministic ids", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyIncidentsSnapshot(firestore, [SAMPLE_INCIDENT]);

    const payload = await listIncidents();
    const incident = payload.items[0];

    assert.equal(payload.count, 1);
    assert.ok(incident);
    assert.match(incident.id, /^inc_[a-f0-9]{16}$/);
    assert.equal(incident.version, 1);
    assert.equal(incident.updatedAt, "2026-04-30T10:00:00.000Z");
    assert.equal((await getIncidentById(incident.id)).title, SAMPLE_INCIDENT.title);
    assert.equal(firestore.read("incidents", incident.id), null);
  });

  it("updates a legacy snapshot incident through the itemized store without removing snapshot fallback", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyIncidentsSnapshot(firestore, [
      SAMPLE_INCIDENT,
      SAMPLE_SECOND_INCIDENT,
    ]);
    const legacyIncident = (await listIncidents()).items.find(
      (incident) => incident.title === SAMPLE_INCIDENT.title,
    );

    assert.ok(legacyIncident);

    const updated = await updateIncident(
      legacyIncident.id,
      {
        owner: "Marina Azevedo",
        status: INCIDENTS[2]!.status,
      },
      {
        baseVersion: 1,
      },
    );
    const loaded = await getIncidentById(legacyIncident.id);
    const payload = await listIncidents();

    assert.equal(updated.version, 2);
    assert.equal(updated.owner, "Marina Azevedo");
    assert.equal(updated.status, INCIDENTS[2]!.status);
    assert.equal(loaded.version, 2);
    assert.equal(
      firestore.read("incidents", legacyIncident.id)?.owner,
      "Marina Azevedo",
    );
    assert.equal(payload.count, 2);
    assert.equal(
      payload.items.find((incident) => incident.id === legacyIncident.id)
        ?.version,
      2,
    );
    assert.equal(
      payload.items.find(
        (incident) => incident.title === SAMPLE_SECOND_INCIDENT.title,
      )?.version,
      1,
    );
  });

  it("creates an incident directly in the item store with version 1", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createIncident(SAMPLE_INCIDENT);
    const loaded = await getIncidentById(created.id);

    assert.match(created.id, /^inc_[a-f0-9]{16}$/);
    assert.equal(created.version, 1);
    assert.equal(loaded.version, 1);
    assert.equal(
      firestore.read("incidents", created.id)?.title,
      SAMPLE_INCIDENT.title,
    );
  });

  it("returns conflict when updating an itemized incident with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("incidents", "inc_manual", {
      ...SAMPLE_INCIDENT,
      id: "inc_manual",
      updatedAt: "2026-04-30T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () =>
        updateIncident(
          "inc_manual",
          {
            owner: "Outra pessoa",
          },
          {
            baseVersion: 2,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof IncidentConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });

  it("rejects payloads that try to change the incident id", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("incidents", "inc_manual", {
      ...SAMPLE_INCIDENT,
      id: "inc_manual",
      updatedAt: "2026-04-30T11:00:00.000Z",
      version: 1,
    });

    await assert.rejects(
      () =>
        updateIncident(
          "inc_manual",
          {
            id: "inc_outro",
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

  it("deletes a legacy snapshot incident through a tombstone without reappearing in hybrid reads", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyIncidentsSnapshot(firestore, [
      SAMPLE_INCIDENT,
      SAMPLE_SECOND_INCIDENT,
    ]);
    const legacyIncident = (await listIncidents()).items.find(
      (incident) => incident.title === SAMPLE_INCIDENT.title,
    );

    assert.ok(legacyIncident);

    const deleted = await deleteIncident(legacyIncident.id, 1);
    const payload = await listIncidents();

    assert.equal(deleted.id, legacyIncident.id);
    assert.equal(deleted.version, 2);
    assert.equal(firestore.read("incidents", legacyIncident.id)?.deleted, true);
    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.title, SAMPLE_SECOND_INCIDENT.title);
    await assert.rejects(
      () => getIncidentById(legacyIncident.id),
      IncidentNotFoundError,
    );
  });

  it("returns conflict when deleting an incident with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("incidents", "inc_manual", {
      ...SAMPLE_INCIDENT,
      id: "inc_manual",
      updatedAt: "2026-04-30T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () => deleteIncident("inc_manual", 2),
      (error: unknown) => {
        assert.ok(error instanceof IncidentConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });
});
