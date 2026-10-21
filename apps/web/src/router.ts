import { useEffect, useState } from "react";

export type Route =
  | { name: "home" }
  | { name: "plugins" }
  | { name: "plugin"; id: string }
  | { name: "timeline" }
  | { name: "ai" };

export const parseHash = (hash: string): Route => {
  const [, first = "", second] = hash.replace(/^#/, "").split("/");
  if (first === "plugins" && second) {
    try { return { name: "plugin", id: decodeURIComponent(second) }; }
    catch { return { name: "plugins" }; }
  }
  if (first === "plugins") return { name: "plugins" };
  if (first === "timeline") return { name: "timeline" };
  if (first === "ai") return { name: "ai" };
  return { name: "home" };
};

export const href = (route: Route): string => {
  switch (route.name) {
    case "home": return "#/";
    case "plugin": return `#/plugins/${encodeURIComponent(route.id)}`;
    default: return `#/${route.name}`;
  }
};

export const navigate = (route: Route) => {
  window.location.hash = href(route);
};

/** 基于 hash 的路由：刷新、前进后退和分享链接都可用，且不需要服务端配置。 */
export const useRoute = () => {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
};
