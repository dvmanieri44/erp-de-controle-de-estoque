import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import {
  createReport,
  deleteReport,
  getReportById,
  listReports,
  ReportConflictError,
  ReportNotFoundError,
  updateReport,
} from "@/lib/server/reports";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests,
} from "@/lib/server/firebase-admin";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const ORIGINAL_ENV = { ...process.env };

const SAMPLE_REPORT = {
  title: "Giro por linha e especie",
  owner: "Controladoria industrial",
  cadence: "Diario",
  lastRun: "Hoje, 07:10",
  summary: "Consolida cobertura, giro e sinais por linha.",
};

const SAMPLE_SECOND_REPORT = {
  title: "Recebimentos em atraso",
  owner: "Planejamento logistico",
  cadence: "Semanal",
  lastRun: "Ontem, 17:40",
  summary: "Aponta fornecedores e janelas com risco de atraso.",
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

function seedLegacyReportsSnapshot(
  firestore: FakeFirestoreAdminDb,
  items: unknown[],
  updatedAt = "2026-05-02T10:00:00.000Z",
) {
  firestore.seed("erpState", "operations.reports", {
    resource: "operations.reports",
    data: items,
    updatedAt,
    version: 3,
  });
}

describe("reports item store", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "test";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("lists legacy snapshot reports with deterministic ids", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyReportsSnapshot(firestore, [SAMPLE_REPORT]);

    const payload = await listReports();
    const item = payload.items[0];

    assert.equal(payload.count, 1);
    assert.ok(item);
    assert.match(item.id, /^report_[a-f0-9]{16}$/);
    assert.equal(item.version, 1);
    assert.equal(item.updatedAt, "2026-05-02T10:00:00.000Z");
    assert.equal((await getReportById(item.id)).title, SAMPLE_REPORT.title);
    assert.equal(firestore.read("reports", item.id), null);
  });

  it("updates a legacy snapshot report through the itemized store without removing snapshot fallback", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyReportsSnapshot(firestore, [SAMPLE_REPORT, SAMPLE_SECOND_REPORT]);
    const legacyItem = (await listReports()).items.find(
      (item) => item.title === SAMPLE_REPORT.title,
    );

    assert.ok(legacyItem);

    const updated = await updateReport(
      legacyItem.id,
      {
        summary: "Consolida cobertura, giro e alertas por linha.",
      },
      {
        baseVersion: 1,
      },
    );
    const loaded = await getReportById(legacyItem.id);
    const payload = await listReports();

    assert.equal(updated.version, 2);
    assert.equal(updated.summary, "Consolida cobertura, giro e alertas por linha.");
    assert.equal(loaded.version, 2);
    assert.equal(
      firestore.read("reports", legacyItem.id)?.summary,
      "Consolida cobertura, giro e alertas por linha.",
    );
    assert.equal(payload.count, 2);
    assert.equal(
      payload.items.find((item) => item.id === legacyItem.id)?.version,
      2,
    );
  });

  it("creates a report directly in the item store with version 1", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createReport(SAMPLE_REPORT);
    const loaded = await getReportById(created.id);

    assert.match(created.id, /^report_[a-f0-9]{16}$/);
    assert.equal(created.version, 1);
    assert.equal(loaded.version, 1);
    assert.equal(firestore.read("reports", created.id)?.title, SAMPLE_REPORT.title);
  });

  it("rejects create when another report already uses the same title", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyReportsSnapshot(firestore, [SAMPLE_REPORT]);

    await assert.rejects(
      () =>
        createReport({
          ...SAMPLE_SECOND_REPORT,
          title: SAMPLE_REPORT.title,
        }),
      (error: unknown) => {
        assert.ok(error instanceof ErpResourceValidationError);
        assert.match(error.message, /ja existe um relatorio com esse titulo/i);
        return true;
      },
    );
  });

  it("returns conflict when updating an itemized report with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("reports", "report_manual", {
      ...SAMPLE_REPORT,
      id: "report_manual",
      updatedAt: "2026-05-02T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () =>
        updateReport(
          "report_manual",
          {
            lastRun: "Hoje, 08:00",
          },
          {
            baseVersion: 2,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof ReportConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });

  it("rejects payloads that try to change the report id", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("reports", "report_manual", {
      ...SAMPLE_REPORT,
      id: "report_manual",
      updatedAt: "2026-05-02T11:00:00.000Z",
      version: 1,
    });

    await assert.rejects(
      () =>
        updateReport(
          "report_manual",
          {
            id: "report_other",
          },
          {
            baseVersion: 1,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof ErpResourceValidationError);
        assert.match(error.message, /id do relatorio precisa corresponder/i);
        return true;
      },
    );
  });

  it("deletes a legacy snapshot report through a tombstone without reappearing in hybrid reads", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyReportsSnapshot(firestore, [SAMPLE_REPORT, SAMPLE_SECOND_REPORT]);
    const legacyItem = (await listReports()).items.find(
      (item) => item.title === SAMPLE_REPORT.title,
    );

    assert.ok(legacyItem);

    const deleted = await deleteReport(legacyItem.id, 1);
    const payload = await listReports();

    assert.equal(deleted.id, legacyItem.id);
    assert.equal(deleted.version, 2);
    assert.equal(firestore.read("reports", legacyItem.id)?.deleted, true);
    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.title, SAMPLE_SECOND_REPORT.title);
    await assert.rejects(() => getReportById(legacyItem.id), ReportNotFoundError);
  });

  it("returns conflict when deleting a report with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("reports", "report_manual", {
      ...SAMPLE_REPORT,
      id: "report_manual",
      updatedAt: "2026-05-02T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () => deleteReport("report_manual", 2),
      (error: unknown) => {
        assert.ok(error instanceof ReportConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });
});
