import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";

/** 读取仓库根目录 .env（npm -w 运行时 cwd 是 apps/api，不能依赖 process.cwd()）。 */
export const loadRootEnv = () =>
  loadDotenv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const int = (value: string | undefined, fallback: number) => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export type GatewayConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  host: string;
  port: number;
  /** 单次回复 token 上限 */
  maxTokens: number;
  /** 每个客户端 IP 每分钟最多请求数 */
  ratePerMinute: number;
  /** 全局每日转发给服务商的请求上限（进程内计数，重启归零） */
  dailyLimit: number;
  timeoutMs: number;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): GatewayConfig => ({
  apiKey: env.DEEPSEEK_API_KEY?.trim() ?? "",
  baseUrl: (env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, ""),
  model: env.DEEPSEEK_MODEL || "deepseek-chat",
  host: env.API_HOST || "127.0.0.1",
  port: int(env.API_PORT, 8787),
  maxTokens: int(env.AI_MAX_TOKENS, 1024),
  ratePerMinute: int(env.AI_RATE_PER_MINUTE, 20),
  dailyLimit: int(env.AI_DAILY_LIMIT, 300),
  timeoutMs: 30_000,
});
