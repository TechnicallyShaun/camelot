import { describe, it, expect, vi } from "vitest";
import { GitHubWorkloadAdapter } from "./github-adapter.js";

describe("GitHubWorkloadAdapter", () => {
  it("loads backlog tickets via gh cli", async () => {
    const exec = vi.fn().mockReturnValue(JSON.stringify([
      {
        number: 92,
        title: "Workload adapter",
        body: "Implement adapter",
        state: "OPEN",
        assignees: [{ login: "shaun" }],
        labels: [{ name: "backlog" }],
        url: "https://github.com/o/r/issues/92",
      },
    ]));

    const adapter = new GitHubWorkloadAdapter("o", "r", undefined, { exec });
    const tickets = await adapter.getBacklog();

    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      id: "92",
      title: "Workload adapter",
      status: "backlog",
      assignee: "shaun",
      source: "github",
    });
    expect(exec).toHaveBeenCalledWith(expect.stringContaining("gh issue list"));
  });

  it("returns ticket detail", async () => {
    const exec = vi.fn().mockReturnValue(JSON.stringify({
      number: 12,
      title: "Issue 12",
      body: "Details",
      state: "OPEN",
      assignees: [],
      labels: [{ name: "in-progress" }],
      url: "https://github.com/o/r/issues/12",
    }));

    const adapter = new GitHubWorkloadAdapter("o", "r", undefined, { exec });
    const ticket = await adapter.getTicket("12");

    expect(ticket).toMatchObject({
      id: "12",
      status: "in-progress",
    });
    expect(exec).toHaveBeenCalledWith(expect.stringContaining("gh issue view 12"));
  });

  it("updates status by adding label", async () => {
    const exec = vi.fn().mockReturnValue("");

    const adapter = new GitHubWorkloadAdapter("o", "r", undefined, { exec });
    const updated = await adapter.updateStatus("45", "in-progress");

    expect(updated).toBe(true);
    expect(exec).toHaveBeenCalledWith(expect.stringContaining("gh issue edit 45"));
  });
});
