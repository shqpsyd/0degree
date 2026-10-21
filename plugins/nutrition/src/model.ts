import type { PluginStorage } from "@zaitu/plugin-sdk";

export type Nutrients = {
  energy: number;
  protein: number;
  fat: number;
  carbohydrate: number;
  fiber: number;
};

export type Food = {
  id: string;
  name: string;
  category: string;
  preparation: string;
  per100g: Nutrients;
};

// Local demonstration fixtures, not a verified food composition database.
export const DATA_VERSION = "demo-v1";
export const FOODS: readonly Food[] = [
  { id: "apple", name: "苹果", category: "水果", preparation: "生，带皮，去核可食部",
    per100g: { energy: 52, protein: 0.3, fat: 0.2, carbohydrate: 13.8, fiber: 2.4 } },
  { id: "egg", name: "鸡蛋", category: "蛋奶豆", preparation: "生，全蛋，去壳可食部；不是食用建议",
    per100g: { energy: 143, protein: 12.6, fat: 9.5, carbohydrate: 0.7, fiber: 0 } },
  { id: "broccoli", name: "西兰花", category: "蔬菜", preparation: "生，可食部",
    per100g: { energy: 34, protein: 2.8, fat: 0.4, carbohydrate: 6.6, fiber: 2.6 } },
  { id: "rice", name: "米饭", category: "谷薯", preparation: "白米，煮熟，无额外油盐",
    per100g: { energy: 130, protein: 2.7, fat: 0.3, carbohydrate: 28.2, fiber: 0.4 } },
  { id: "milk", name: "牛奶", category: "蛋奶豆", preparation: "全脂，按重量计算，不按毫升换算",
    per100g: { energy: 61, protein: 3.2, fat: 3.3, carbohydrate: 4.8, fiber: 0 } },
  { id: "chicken", name: "鸡胸肉", category: "肉类", preparation: "去皮，熟制，无额外油盐",
    per100g: { energy: 165, protein: 31, fat: 3.6, carbohydrate: 0, fiber: 0 } },
];

export const STORAGE_KEY = "selection.v1";
export type Selection = { foodId: string; grams: number };
export const DEFAULT_SELECTION: Selection = { foodId: "apple", grams: 100 };

export function validGrams(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 2000;
}

export function parseGrams(value: string): number | null {
  if (!value.trim()) return null;
  const grams = Number(value);
  return validGrams(grams) ? grams : null;
}

export function calculate(food: Food, grams: number): Nutrients {
  if (!validGrams(grams)) throw new RangeError("重量须为 1–2000 克");
  const ratio = grams / 100;
  return {
    energy: food.per100g.energy * ratio,
    protein: food.per100g.protein * ratio,
    fat: food.per100g.fat * ratio,
    carbohydrate: food.per100g.carbohydrate * ratio,
    fiber: food.per100g.fiber * ratio,
  };
}

export function readSelection(storage: PluginStorage): { selection: Selection; message: string } {
  try {
    const saved = storage.get<unknown>(STORAGE_KEY, null);
    if (saved === null) return { selection: DEFAULT_SELECTION, message: "当前为示例选择，尚未保存。" };
    if (typeof saved === "object" && saved !== null && !Array.isArray(saved)) {
      const value = saved as Record<string, unknown>;
      if (value.version === 1 && typeof value.foodId === "string" &&
        FOODS.some(food => food.id === value.foodId) && validGrams(value.grams)) {
        return { selection: { foodId: value.foodId, grams: value.grams }, message: "已恢复当前浏览器保存的选择。" };
      }
    }
    return { selection: DEFAULT_SELECTION, message: "保存的数据已失效，已使用示例选择；原数据未被覆盖。" };
  } catch {
    return { selection: DEFAULT_SELECTION, message: "无法读取本机数据，仍可使用示例探索营养。" };
  }
}
