import { describe, expect, it } from "vitest";
import { PgReportStore } from "@/reports/pg-store";
import { ScriptedExecutor } from "../helpers/scripted-db";
import { VALID_ADVISORY } from "../helpers/fixtures";

const READY_ROW = {
  cache_key: "k1",
  status: "ready",
  content: VALID_ADVISORY,
  model: "example/model-name",
  updated_at: "2026-10-15T00:00:00.000Z",
  error: null,
};

describe("PgReportStore", () => {
  it("maps a ready row into the ReportBaseRow shape", async () => {
    const db = new ScriptedExecutor([[READY_ROW]]);
    const store = new PgReportStore(db);

    const row = await store.get("k1");

    expect(row).toMatchObject({ key: "k1", status: "ready", content: VALID_ADVISORY });
    expect(row?.updatedAt).toBe(Date.parse("2026-10-15T00:00:00.000Z"));
    expect(db.calls[0]?.params).toEqual(["k1"]);
  });

  it("reports inserted=true only when the guarded insert returns a row", async () => {
    const won = new PgReportStore(new ScriptedExecutor([[{ cache_key: "k1" }]]));
    const lost = new PgReportStore(new ScriptedExecutor([[]]));

    expect(await won.insertGenerating("k1")).toEqual({ inserted: true });
    expect(await lost.insertGenerating("k1")).toEqual({ inserted: false });
  });

  it("uses ON CONFLICT DO NOTHING for the double-generation guard", async () => {
    const db = new ScriptedExecutor([[{ cache_key: "k1" }]]);
    await new PgReportStore(db).insertGenerating("k1");
    expect(db.calls[0]?.text).toMatch(/on conflict \(cache_key\) do nothing/i);
  });

  it("returns the updated row from markReady", async () => {
    const db = new ScriptedExecutor([[READY_ROW]]);
    const row = await new PgReportStore(db).markReady("k1", VALID_ADVISORY, "example/model-name");
    expect(row.status).toBe("ready");
    expect(db.calls[0]?.params).toEqual(["k1", VALID_ADVISORY, "example/model-name"]);
  });

  it("marks a row failed with the error message", async () => {
    const db = new ScriptedExecutor([[]]);
    await new PgReportStore(db).markFailed("k1", "boom");
    expect(db.calls[0]?.text).toMatch(/status = 'failed'/i);
    expect(db.calls[0]?.params).toEqual(["k1", "boom"]);
  });
});
