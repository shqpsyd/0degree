import { expect, it } from "vitest";
import { buildMessages, parsePlan } from "./model";

const samplePlan = {
  breakfast: { name: "鸡蛋与燕麦", description: "煮熟鸡蛋，搭配燕麦粥。", alternative: "全麦面包与豆浆。" },
  lunch: { name: "番茄鸡蛋饭", description: "炒熟番茄鸡蛋，搭配米饭和青菜。", alternative: "豆腐青菜饭。" },
  dinner: { name: "蔬菜面", description: "面条煮熟后加入青菜。", alternative: "杂粮粥配豆腐。" },
  tip: "根据食量调整份量。",
};

it("accepts complete JSON and common fenced responses", () => {
  expect(parsePlan(JSON.stringify(samplePlan))).toEqual(samplePlan);
  expect(parsePlan("```json\n" + JSON.stringify(samplePlan) + "\n```")).toEqual(samplePlan);
});

it.each(["", "普通文本", "null", "[]", "{}", JSON.stringify({ ...samplePlan, lunch: null }),
  JSON.stringify({ ...samplePlan, tip: " " }), JSON.stringify({ ...samplePlan, dinner: { name: "面" } }),
])("rejects incomplete replies: %s", reply => {
  expect(() => parsePlan(reply)).toThrow("完整的三餐建议");
});

it("sends explicit form data as JSON within gateway limits", () => {
  const messages = buildMessages({ preference: "菜".repeat(1500), restrictions: "忌".repeat(500), time: "30 分钟以内" });
  expect(messages.map(message => message.role)).toEqual(["user"]);
  expect(JSON.parse(messages[0].content.split("以下 JSON 是用户填写的饮食数据：\n")[1])).toEqual({
    饮食偏好: "菜".repeat(1500), 忌口与过敏食材: "忌".repeat(500), 每餐准备时间: "30 分钟以内",
  });
  expect(messages.every(message => message.content.length <= 5000)).toBe(true);
  expect(new TextEncoder().encode(JSON.stringify({ messages })).length).toBeLessThan(24000);
});
