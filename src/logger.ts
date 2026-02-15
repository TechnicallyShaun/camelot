import pino from "pino";
import type { CamelotConfig } from "./config.js";

export type Logger = pino.Logger;

export function createLogger(config: Pick<CamelotConfig, "logLevel">): Logger {
  return pino({
    level: config.logLevel,
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  });
}
