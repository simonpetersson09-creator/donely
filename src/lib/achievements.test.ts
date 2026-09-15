import { describe, expect, it } from "vitest";
import { detectAchievement, milestoneCrossed, nextMilestone } from "@/lib/achievements";

describe("milestones", () => {
  it("only fires on a real crossing", () => {
    expect(milestoneCrossed(9, 10)).toBe(10);
    expect(milestoneCrossed(10, 12)).toBeNull();
    expect(milestoneCrossed(98, 260)).toBe(250);
  });

  it("grows the step size", () => {
    expect(nextMilestone(0)).toBe(10);
    expect(nextMilestone(100)).toBe(250);
    expect(nextMilestone(1000)).toBe(2000);
    expect(nextMilestone(5200)).toBe(10000);
  });
});

describe("detectAchievement milestones", () => {
  let seq = 0;
  const cat = () => `c${++seq}`;
  const entry = (id: string, amount: number, daysAgo: number) => ({
    id: `${amount}-${daysAgo}-${Math.random()}`,
    area: "jobb" as const,
    categoryId: id,
    categoryName: "Test",
    amount,
    createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  });

  it("never celebrates a long-passed milestone", () => {
    const c = cat();
    // Total 300 before, +1 now -> no milestone crossed.
    const entries = [entry(c, 1, 0), ...Array.from({ length: 30 }, (_, i) => entry(c, 10, i + 40))];
    const found = detectAchievement(entries, c, new Date(), 1);
    expect(found?.kind).not.toBe("milestone");
  });

  it("celebrates the milestone actually crossed", () => {
    const c = cat();
    const entries = [entry(c, 5, 0), ...Array.from({ length: 4 }, (_, i) => entry(c, 5, i + 40))];
    const found = detectAchievement(entries, c, new Date(), 5);
    expect(found).toMatchObject({ kind: "milestone", target: 25 });
  });
});
