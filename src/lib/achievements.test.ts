import { describe, expect, it } from "vitest";
import { milestoneCrossed, nextMilestone } from "@/lib/achievements";

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
