/**
 * Minimal structured logger. Real deployments swap this for pino/Sentry; the
 * point here is that the core logs through one seam, not scattered
 * console.log calls, so log shape stays consistent and routing is a one-line
 * change.
 */

type Fields = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", msg: string, fields?: Fields): void {
  const line = { level, msg, ...fields };
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(
    JSON.stringify(line),
  );
}

export const logger = {
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),
};
