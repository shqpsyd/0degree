import { expect, it } from "vitest";
import { buildMessages, EMPTY_DRAFT, fields, readDraft, validateDraft } from "./model";

it("rejects blank titles and oversized input", () => {
  expect(validateDraft({ ...EMPTY_DRAFT, title: "  " }).title).toBeTruthy();
  for (const field of fields) {
    expect(validateDraft({ ...EMPTY_DRAFT, title: "书", [field.key]: "字".repeat(field.max + 1) })[field.key])
      .toBeTruthy();
  }
  expect(() => buildMessages(EMPTY_DRAFT)).toThrow();
});

it("keeps maximum input including control characters within gateway limits", () => {
  const draft = { title: "书".repeat(160), goal: "\n".repeat(400), review: "\\".repeat(600), excerpt: '"'.repeat(2400) };
  expect(buildMessages(draft)[0].content.length).toBeLessThanOrEqual(5000);
  expect(buildMessages(draft)[0].content).toContain("局部原文摘录");
  expect(buildMessages({ ...EMPTY_DRAFT, title: "未知书" })[0].content).toContain("未提供原文");
});

it("recovers from invalid persisted data without overwriting it", () => {
  for (const value of [false, [], { version: 2 }, { version: 1, ...EMPTY_DRAFT, excerpt: 42 }]) {
    const result = readDraft({
      get: <T,>() => value as T, set: () => { throw Error("must not write"); }, remove: () => {}
    });
    expect(result.failed).toBe(true);
    expect(result.draft).toEqual(EMPTY_DRAFT);
  }
});
