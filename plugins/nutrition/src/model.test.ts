import { describe, expect, it, vi } from "vitest";
import { calculate, DEFAULT_SELECTION, FOODS, parseGrams, readSelection } from "./model";

describe("nutrition portions", () => {
  it("scales all nutrients by edible weight without early rounding", () => {
    expect(calculate(FOODS[0], 200)).toEqual({ energy: 104, protein: 0.6, fat: 0.4, carbohydrate: 27.6, fiber: 4.8 });
    expect(calculate(FOODS[0], 33.3).protein).toBeCloseTo(0.0999);
    expect(calculate(FOODS[1], 100).fiber).toBe(0);
  });
  it.each(["", " ", "0", "-1", "0.9", "2000.1", "Infinity", "NaN", "1e309", "abc"])(
    "rejects invalid grams %s", value => {
    expect(parseGrams(value)).toBeNull();
  });
  it("accepts boundaries and rejects invalid direct calculations", () => {
    expect(parseGrams("1")).toBe(1);
    expect(parseGrams("2000")).toBe(2000);
    expect(parseGrams("33.3")).toBe(33.3);
    expect(() => calculate(FOODS[0], Infinity)).toThrow(RangeError);
    expect(() => calculate(FOODS[0], 0)).toThrow(RangeError);
  });
});

describe("nutrition saved selection", () => {
  const storage = (value: unknown) => ({
    get: <T,>(_key: string, _fallback: T) => value as T,
    set: vi.fn(),
    remove: vi.fn(),
  });
  it("restores a known food and valid weight", () => {
    expect(readSelection(storage({ version: 1, foodId: "rice", grams: 150 })).selection)
      .toEqual({ foodId: "rice", grams: 150 });
  });
  it.each([
    null, [], "bad", { version: 2, foodId: "apple", grams: 100 }, { version: 1, foodId: "missing", grams: 100 },
    { version: 1, foodId: "egg", grams: "100" }, { version: 1, foodId: "egg", grams: Infinity }
  ])("falls back without overwriting data %#", value => {
    const store = storage(value);
    expect(readSelection(store).selection).toEqual(DEFAULT_SELECTION);
    expect(store.set).not.toHaveBeenCalled();
  });
  it("handles unavailable storage", () => {
    const store = storage(null);
    store.get = () => { throw new Error("denied"); };
    expect(readSelection(store).message).toContain("无法读取");
  });
});
