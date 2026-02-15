import { describe, it, expect } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("returns defaults when no config file exists", () => {
    const config = loadConfig("/nonexistent/path.json");
    expect(config.port).toBe(1187);
    expect(config.host).toBe("127.0.0.1");
    expect(config.defaultAgent).toBe("copilot");
    expect(config.logLevel).toBe("info");
  });
});
