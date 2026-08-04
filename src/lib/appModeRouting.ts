export type AppMode = "fco" | "technical-alert" | "announcement" | "home";

const PATH_BY_MODE: Record<AppMode, string> = {
  home: "/",
  fco: "/fco",
  "technical-alert": "/technical-alert",
  announcement: "/announcement",
};

const MODE_BY_PATH: Record<string, AppMode> = {
  "/": "home",
  "/fco": "fco",
  "/technical-alert": "technical-alert",
  // Phase 9 cutover: /technical-alert-v2 was the pre-cutover preview URL for
  // the (now the only) Technical Alert workflow. Kept as an alias so any
  // bookmark from development still resolves correctly rather than 404ing.
  "/technical-alert-v2": "technical-alert",
  "/announcement": "announcement",
};

export function pathForMode(mode: AppMode): string {
  return PATH_BY_MODE[mode];
}

export function modeForPath(pathname: string): AppMode {
  return MODE_BY_PATH[pathname] ?? "home";
}
