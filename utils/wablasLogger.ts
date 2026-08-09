import fs from "fs";
import path from "path";

// ponytail: append-only file + stdout. Swap for pino if volume gets heavy.
const LOG_FILE = process.env.WABLAS_LOG_FILE || path.join(process.cwd(), "logs", "wablas.log");

function write(level: string, msg: string, extra?: unknown) {
  const line = `[${new Date().toISOString()}] [WABLAS] [${level}] ${msg}${
    extra === undefined ? "" : " " + safeJson(extra)
  }`;

  // stdout so `docker logs indoclimate-app | grep WABLAS` works
  (level === "ERROR" ? console.error : console.log)(line);

  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch {
    // file logging is best-effort; stdout already has it
  }
}

function safeJson(v: unknown): string {
  try {
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export const wablasLog = {
  info: (msg: string, extra?: unknown) => write("INFO", msg, extra),
  warn: (msg: string, extra?: unknown) => write("WARN", msg, extra),
  error: (msg: string, extra?: unknown) => write("ERROR", msg, extra),
  file: LOG_FILE,
};
