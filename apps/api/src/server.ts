import { createServer } from "node:http";
import { createHandler } from "./app";
import { loadConfig, loadRootEnv } from "./config";

loadRootEnv();
const config = loadConfig();

const server = createServer(createHandler(config));
server.requestTimeout = 60_000;
server.listen(config.port, config.host, () => {
  console.log(`ZAITU API listening at http://${config.host}:${config.port}`);
  if (!config.apiKey) console.warn("DEEPSEEK_API_KEY 未配置，AI 功能将返回 503。");
});
