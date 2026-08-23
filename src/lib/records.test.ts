import { describe, expect, it } from "vitest";
import { detectRecords, recordHighlights, bestRecord } from "@/lib/records";

const mk = (daysAgo: number, amount: number, id = "moten") => {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(10,0,0,0);
  return { id: String(Math.random()), area: "jobb" as const, categoryId: id, categoryName: "Möten", amount, createdAt: d.toISOString() };
};

describe("records", () => {
  it("no record on first entry", () => {
    expect(detectRecords([mk(0, 5)], "moten")).toEqual([]);
  });
  it("detects day record with history", () => {
    const e = [mk(1,2),mk(2,3),mk(3,1),mk(4,4),mk(0,5)];
    const r = detectRecords(e, "moten").find(x=>x.type==="day");
    expect(r?.value).toBe(5); expect(r?.previous).toBe(4);
  });
  it("tie is not a record", () => {
    const e = [mk(1,2),mk(2,3),mk(3,1),mk(4,4),mk(0,4)];
    expect(detectRecords(e,"moten").some(x=>x.type==="day")).toBe(false);
  });
  it("highlights", () => {
    const e = [mk(1,2),mk(2,3),mk(3,1),mk(4,4),mk(0,5)];
    const rows = recordHighlights(e, [{id:"moten",name:"Möten",area:"jobb"}] as any);
    expect(rows.length).toBeGreaterThan(0);
  });
  it("bestRecord null without history", () => {
    expect(bestRecord([mk(0,9)], "moten", "day")).toBeNull();
  });
});
