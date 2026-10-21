import { describe, expect, it } from "vitest";
import { IDEAS, parseOptions, pickNext, remainingSeconds } from "./model";
import { registerModules, type LeisureModule } from "./registry";

describe("leisure models", () => {
  it("never repeats the current suggestion and supports a single option", () => {
    for (const idea of IDEAS) {
      for (let count = 0; count < 30; count++) {
        expect(pickNext(IDEAS, idea)).not.toBe(idea);
      }
    }
    expect(pickNext(["one"], "one")).toBe("one");
    expect(() => pickNext([])).toThrow("没有可抽取");
  });
  it("trims options and removes blank lines and duplicates", () => {
    expect(parseOptions(" 散步 \r\n\n听歌\n散步\n ")).toEqual(["散步", "听歌"]);
  });
  it("uses elapsed wall time and never shows negative seconds", () => {
    expect(remainingSeconds(10000, 8501)).toBe(2);
    expect(remainingSeconds(10000, 50000)).toBe(0);
  });
  it("rejects duplicate or invalid module identifiers", () => {
    const module: LeisureModule = { id: "test", name: "测试", icon: "", description: "", Component: () => null };
    expect(registerModules([module])).toEqual([module]);
    expect(() => registerModules([module, module])).toThrow();
    expect(() => registerModules([{ ...module, id: "../invalid" }])).toThrow();
  });
});
