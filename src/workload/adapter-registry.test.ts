import { describe, it, expect } from "vitest";
import { WorkloadAdapterRegistry } from "./adapter-registry.js";
import type { WorkloadAdapter } from "./types.js";

function createAdapter(name: string): WorkloadAdapter {
  return {
    getBacklog: async () => [{ id: `${name}-1`, title: "", description: "", status: "backlog", assignee: null, labels: [], url: "", source: name }],
    getInProgress: async () => [],
    getTicket: async () => undefined,
    getMyWork: async () => [],
    updateStatus: async () => true,
  };
}

describe("WorkloadAdapterRegistry", () => {
  it("registers and lists adapters", () => {
    const registry = new WorkloadAdapterRegistry();
    registry.register("github", createAdapter("github"), true);
    registry.register("jira", createAdapter("jira"));

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.find((item) => item.name === "github")?.isActive).toBe(true);
  });

  it("switches active adapter", () => {
    const registry = new WorkloadAdapterRegistry();
    registry.register("github", createAdapter("github"), true);
    registry.register("jira", createAdapter("jira"));

    expect(registry.setActive("jira")).toBe(true);
    expect(registry.getActiveName()).toBe("jira");
    expect(registry.setActive("missing")).toBe(false);
  });
});
