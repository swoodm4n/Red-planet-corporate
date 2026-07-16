import { describe, it, expect } from "vitest";
import { cr, toCr, fpMul, roundHalfUp, displayCr, FP_SCALE } from "../src/money.js";

describe("fixed-point money", () => {
  it("cr/toCr round-trip whole and fractional credits", () => {
    expect(cr(30)).toBe(300000);
    expect(cr(0.5)).toBe(5000);
    expect(cr(1.5)).toBe(15000);
    expect(toCr(300000)).toBe(30);
    expect(toCr(5000)).toBe(0.5);
    expect(FP_SCALE).toBe(10000);
  });

  it("roundHalfUp rounds .5 up", () => {
    expect(roundHalfUp(0.5)).toBe(1);
    expect(roundHalfUp(1.5)).toBe(2);
    expect(roundHalfUp(2.4)).toBe(2);
    expect(roundHalfUp(-0.5)).toBe(0);
  });

  it("fpMul rounds half-up", () => {
    // 5000 * 0.8 = 4000
    expect(fpMul(5000, 0.8)).toBe(4000);
    // 4940 * 1 = 4940
    expect(fpMul(4940, 1)).toBe(4940);
    // 3 * 0.5 = 1.5 -> 2
    expect(fpMul(3, 0.5)).toBe(2);
  });

  it("displayCr rounds to 2 decimals half-up", () => {
    expect(displayCr(4955)).toBe(0.5); // 0.4955 -> 0.50
    expect(displayCr(4940)).toBe(0.49);
    expect(displayCr(106500)).toBe(10.65);
    expect(displayCr(3300)).toBe(0.33);
  });
});
