import { describe, it, expect } from "vitest";
import { createLogger } from "./logger.js";

describe("createLogger", () => {
  it("creates a logger with the configured level", () => {
    const logger = createLogger({ logLevel: "debug" });
    expect(logger).toBeDefined();
    expect(logger.level).toBe("debug");
  });

  it("defaults to info when configured", () => {
    const logger = createLogger({ logLevel: "info" });
    expect(logger.level).toBe("info");
  });
});
