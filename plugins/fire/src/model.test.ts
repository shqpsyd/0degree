import { describe, expect, it, vi } from "vitest";
import { calculate, DEFAULT_PLAN, parseDraft, readPlan, toDraft } from "./model";

describe("FIRE calculation", () => {
  it("converts annual percentage and monthly spending to an asset target", () => {
    expect(calculate(DEFAULT_PLAN)).toMatchObject({
      annualCost: 120000, target: 3000000, gap: 2500000,
    });
    expect(calculate(DEFAULT_PLAN).coverage).toBeCloseTo(16.6666667);
  });
  it("keeps surplus coverage and never reports a negative gap", () => {
    const result = calculate({ ...DEFAULT_PLAN, assets: 6000000 });
    expect(result.gap).toBe(0);
    expect(result.coverage).toBe(200);
  });
  it("does not divide by zero for zero spending", () => {
    expect(calculate({ ...DEFAULT_PLAN, monthlyCost: 0 })).toEqual({
      annualCost: 0, target: 0, gap: 0, coverage: null,
    });
  });
  it("retains precision before presentation and orders rate comparisons", () => {
    expect(calculate({ monthlyCost: 1234.56, assets: 100, rate: 3.5 }).target).toBeCloseTo(423277.7142857);
    expect(calculate({ ...DEFAULT_PLAN, rate: 3 }).target).toBe(4000000);
    expect(calculate({ ...DEFAULT_PLAN, rate: 5 }).target).toBe(2400000);
  });
  it.each(["", " ", "-1", "Infinity", "NaN", "1e309", "0.0000001", "1000000001"])(
    "rejects invalid monthly cost %s", value => {
    expect(parseDraft({ ...toDraft(DEFAULT_PLAN), monthlyCost: value }).plan).toBeNull();
  });
  it.each(["0", "0.09", "20.1", ""])("rejects invalid rate %s", rate => {
    expect(parseDraft({ ...toDraft(DEFAULT_PLAN), rate }).errors.rate).toBeTruthy();
  });
  it("accepts boundaries and rejects invalid direct calculations", () => {
    expect(calculate({ monthlyCost: 1e9, assets: 1e12, rate: 0.1 }).target).toBe(1.2e13);
    expect(parseDraft({ monthlyCost: "0", assets: "0", rate: "20" }).plan).not.toBeNull();
    expect(() => calculate({ ...DEFAULT_PLAN, rate: 0 })).toThrow(RangeError);
  });
});

describe("saved plans", () => {
  function storage(value: unknown) {
    return { get: <T,>(_key: string, _fallback: T) => value as T, set: vi.fn(), remove: vi.fn() };
  }
  it("loads a versioned plan", () => {
    const plan = { monthlyCost: 8000, assets: 900000, rate: 3 };
    expect(readPlan(storage({ version: 1, ...plan })).plan).toEqual(plan);
  });
  it.each([
    null, [], "bad", { version: 2, ...DEFAULT_PLAN }, { version: 1, ...DEFAULT_PLAN, rate: 0 },
    { version: 1, ...DEFAULT_PLAN, assets: "500" }, { version: 1, ...DEFAULT_PLAN, monthlyCost: Infinity }
  ])("safely handles missing or malformed persisted data %#", value => {
    const store = storage(value);
    expect(readPlan(store).plan).toEqual(DEFAULT_PLAN);
    expect(store.set).not.toHaveBeenCalled();
  });
  it("remains usable when storage throws", () => {
    const store = storage(null);
    store.get = () => { throw new Error("denied"); };
    expect(readPlan(store).message).toContain("无法读取");
  });
});
