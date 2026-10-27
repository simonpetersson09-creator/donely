import { describe, expect, it } from "vitest";
import { isYearlyProduct, LEGACY_MONTHLY_PRODUCT_ID, PRODUCT_ID } from "./premium";

describe("premium products", () => {
  it("offers the yearly product for new purchases", () => {
    expect(PRODUCT_ID).toBe("se.shiningdays.donely.premium.yearly");
  });
  it("keeps the old monthly id known for existing subscribers", () => {
    expect(LEGACY_MONTHLY_PRODUCT_ID).toBe("se.shiningdays.donely.premium.monthly");
  });
  it("shows yearly copy only for the yearly product", () => {
    expect(isYearlyProduct("se.shiningdays.donely.premium.yearly")).toBe(true);
    expect(isYearlyProduct("se.shiningdays.donely.premium.monthly")).toBe(false);
  });
});
