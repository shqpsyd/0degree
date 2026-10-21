import type { PluginStorage } from "@zaitu/plugin-sdk";

export type Plan = { monthlyCost: number; assets: number; rate: number };
export type Draft = Record<keyof Plan, string>;
export const STORAGE_KEY = "plan.v1";
export const DEFAULT_PLAN: Readonly<Plan> = { monthlyCost: 10000, assets: 500000, rate: 4 };
const limits: Record<keyof Plan, [number, number, string]> = {
  monthlyCost: [0, 1e9, "请输入 0 至 10 亿元之间的月支出。"],
  assets: [0, 1e12, "请输入 0 至 1 万亿元之间的可投资净资产。"],
  rate: [0.1, 20, "请输入 0.1% 至 20% 之间的提款率。"],
};

export function toDraft(plan: Readonly<Plan>): Draft {
  return { monthlyCost: String(plan.monthlyCost), assets: String(plan.assets), rate: String(plan.rate) };
}

export function parseDraft(draft: Draft) {
  const errors: Partial<Record<keyof Plan, string>> = {};
  const plan = {} as Plan;
  for (const key of Object.keys(limits) as (keyof Plan)[]) {
    const [min, max, message] = limits[key];
    const value = Number(draft[key]);
    if (!draft[key].trim() || !Number.isFinite(value) || value < min || value > max) errors[key] = message;
    else if (key !== "rate" && value > 0 && value < 0.01) errors[key] = "非零金额至少为 0.01 元。";
    plan[key] = value;
  }
  return { plan: Object.keys(errors).length ? null : plan, errors };
}

export function calculate(plan: Plan) {
  if (!parseDraft(toDraft(plan)).plan) throw new RangeError("无效的 FIRE 参数");
  const annualCost = plan.monthlyCost * 12;
  const target = annualCost / (plan.rate / 100);
  return {
    annualCost,
    target,
    gap: Math.max(0, target - plan.assets),
    coverage: target === 0 ? null : plan.assets / target * 100,
  };
}

export function readPlan(storage: PluginStorage): { plan: Plan; message: string } {
  try {
    const saved = storage.get<unknown>(STORAGE_KEY, null);
    if (saved === null) return { plan: { ...DEFAULT_PLAN }, message: "当前为示例参数，修改后可保存本机方案。" };
    if (typeof saved === "object" && saved !== null && "version" in saved && saved.version === 1) {
      const candidate = saved as Record<string, unknown>;
      if (Object.keys(limits).every(key => typeof candidate[key] === "number")) {
        const { plan } = parseDraft(toDraft(candidate as unknown as Plan));
        if (plan) return { plan, message: "已载入本机保存的方案。" };
      }
    }
    return { plan: { ...DEFAULT_PLAN }, message: "已保存的参数格式无效，暂用示例参数；保存后将替换原方案。" };
  } catch {
    return { plan: { ...DEFAULT_PLAN }, message: "暂时无法读取本机方案，当前使用示例参数。" };
  }
}
