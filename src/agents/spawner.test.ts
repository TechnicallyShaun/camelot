import { describe, it, expect, beforeEach } from "vitest";
import { ProcessAgentSpawner } from "./spawner.js";
import { createLogger } from "../logger.js";

describe("ProcessAgentSpawner", () => {
  let spawner: ProcessAgentSpawner;

  beforeEach(() => {
    const logger = createLogger({ logLevel: "error" });
    spawner = new ProcessAgentSpawner(logger);
  });

  it("spawns a process and returns an AgentProcess", () => {
    const proc = spawner.spawn({
      name: "test",
      command: "echo",
      args: ["hello"],
      cwd: process.cwd(),
    });
    expect(proc.id).toBeDefined();
    expect(proc.status).toBe("running");
  });

  it("lists spawned processes", () => {
    spawner.spawn({ name: "a", command: "echo", args: ["a"], cwd: process.cwd() });
    spawner.spawn({ name: "b", command: "echo", args: ["b"], cwd: process.cwd() });
    expect(spawner.list()).toHaveLength(2);
  });

  it("emits stdout events", async () => {
    const events: Array<{ type: string; data: string }> = [];
    spawner.onEvent((e) => events.push({ type: e.type, data: e.data }));

    spawner.spawn({
      name: "echo-test",
      command: "echo",
      args: ["hello-camelot"],
      cwd: process.cwd(),
    });

    await new Promise((r) => setTimeout(r, 500));
    const stdoutEvents = events.filter((e) => e.type === "stdout");
    expect(stdoutEvents.some((e) => e.data.includes("hello-camelot"))).toBe(true);
  });
});
