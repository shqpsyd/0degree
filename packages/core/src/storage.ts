/** localStorage 的安全读写：解析失败返回 fallback，写入失败（配额满/隐私模式）抛出可读错误。 */
export const readJSON = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
};

export const writeJSON = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error("本地存储空间不足或不可用，记录未保存");
  }
};

export const readBooleanMap = (key: string): Record<string, boolean> => {
  const value = readJSON<unknown>(key, {});
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([id, v]) => /^zaitu\.[a-z][a-z0-9-]*$/.test(id) && typeof v === "boolean"),
  );
};

export const removeKey = (key: string) => {
  try { localStorage.removeItem(key); }
  catch { throw new Error("本地存储不可用，数据未删除"); }
};

/** 列出某前缀下的全部 key，用于清理插件私有数据。 */
export const keysWithPrefix = (prefix: string) => {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
  } catch { throw new Error("本地存储不可用，数据未删除"); }
  return keys;
};
