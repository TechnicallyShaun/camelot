import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export interface CamelotConfig {
  readonly port: number;
  readonly host: string;
  readonly dataDir: string;
  readonly logLevel: "debug" | "info" | "warn" | "error";
  readonly defaultAgent: string;
  readonly sdpPlansPath: string | null;
  readonly skillsPublishPath: string;
  readonly dailySummaryExportPath: string;
  readonly defaultTerminalCwd: string;
}

const DEFAULTS: CamelotConfig = {
  port: 1187,
  host: "127.0.0.1",
  dataDir: "./data",
  logLevel: "info",
  defaultAgent: "copilot",
  sdpPlansPath: null,
  skillsPublishPath: "./skills",
  dailySummaryExportPath: "./daily-summaries",
  defaultTerminalCwd: process.cwd(),
};

export function loadConfig(configPath?: string): CamelotConfig {
  const filePath = configPath ?? resolve(process.cwd(), "camelot.config.json");

  if (!existsSync(filePath)) {
    return { ...DEFAULTS };
  }

  try {
    const raw = readFileSync(filePath, "utf-8");
    const userConfig = JSON.parse(raw) as Partial<CamelotConfig>;
    return { ...DEFAULTS, ...userConfig };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load config from ${filePath}: ${message}`);
  }
}
