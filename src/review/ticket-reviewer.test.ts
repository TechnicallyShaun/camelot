import { describe, it, expect, vi } from "vitest";
import { TicketReviewer } from "./ticket-reviewer.js";
import type { TicketForReview } from "./ticket-reviewer.js";
import type { Logger } from "../logger.js";

function mockLogger(): Logger {
  return {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    fatal: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis(),
    level: "silent", silent: vi.fn(),
  } as unknown as Logger;
}

describe("TicketReviewer", () => {
  it("flags tickets with no description", () => {
    const reviewer = new TicketReviewer({ logger: mockLogger() });
    const tickets: TicketForReview[] = [
      { id: "1", title: "Fix bug" },
    ];
    const summary = reviewer.review(tickets);
    expect(summary.ticketCount).toBe(1);
    expect(summary.reviews[0]!.ambiguities.length).toBeGreaterThan(0);
    expect(summary.reviews[0]!.ambiguities).toContain("Very short description — likely missing detail");
    expect(summary.reviews[0]!.ambiguities).toContain("No acceptance criteria found");
  });

  it("detects risks in tickets with DB changes", () => {
    const reviewer = new TicketReviewer({ logger: mockLogger() });
    const tickets: TicketForReview[] = [
      { id: "2", title: "Add user table", description: "Create a new database migration to add user profiles table with columns for name, email, avatar." },
    ];
    const summary = reviewer.review(tickets);
    expect(summary.reviews[0]!.risks).toContain("Database changes detected — migration planning needed");
    expect(summary.reviews[0]!.size).not.toBe("S");
  });

  it("sizes simple tickets as S", () => {
    const reviewer = new TicketReviewer({ logger: mockLogger() });
    const tickets: TicketForReview[] = [
      { id: "3", title: "Update readme", description: "Update the README with new install instructions.\n\n## Acceptance Criteria\n- Given the readme, when a user reads it, then they can install the app." },
    ];
    const summary = reviewer.review(tickets);
    expect(summary.reviews[0]!.size).toBe("S");
    expect(summary.reviews[0]!.ambiguities).toHaveLength(0);
  });

  it("generates markdown summary", () => {
    const reviewer = new TicketReviewer({ logger: mockLogger() });
    const tickets: TicketForReview[] = [
      { id: "1", title: "Task A", description: "Short" },
      { id: "2", title: "Task B", description: "A detailed task with acceptance criteria and database migration steps.\n\n## Acceptance Criteria\nGiven X when Y then Z" },
    ];
    const summary = reviewer.review(tickets);
    expect(summary.markdown).toContain("# Ticket Review Summary");
    expect(summary.markdown).toContain("Size Distribution");
    expect(summary.markdown).toContain("Task A");
    expect(summary.markdown).toContain("Task B");
  });

  it("returns empty summary for no tickets", () => {
    const reviewer = new TicketReviewer({ logger: mockLogger() });
    const summary = reviewer.review([]);
    expect(summary.ticketCount).toBe(0);
    expect(summary.markdown).toContain("No tickets to review");
  });
});
