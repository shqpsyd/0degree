import { registerModules } from "../registry";
import { BreakTimer } from "./timer";
import { Choice } from "./choice";

export const modules = registerModules([
  { id: "break-timer", name: "休息计时器", description: "留出一小段空白，休息结束时给你安静的文字提醒。", icon: "⏳", Component: BreakTimer },
  { id: "choice", name: "随心选一个", description: "在几个轻松的选项间犹豫？把小决定交给一次抽签。", icon: "🍃", Component: Choice },
]);
