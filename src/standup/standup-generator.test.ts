import { describe, it, expect, vi } from "vitest";
import { StandupGenerator } from "./standup-generator.js";
import type { TicketActivityRepository, TicketRepository, TicketActivity, Ticket } from "../db/types.js";
import type { Logger } from "../logger.js";

function mockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn().mockReturnThis(),
    level: "silent",
    silent: vi.fn(),
  } as unknown as Logger;
}

function makeActivity(overrides: Partial<TicketActivity> & { id: number; ticketId: number; action: TicketActivity["action"] }): TicketActivity {
  return {
    sessionId: "sess-1",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("StandupGenerator", () => {
  it("generates empty report when no activities", () => {
    const ticketActivity: TicketActivityRepository = {
      create: vi.fn() as never,
      findAll: vi.fn().mockReturnValue([]),
      findByTicketId: vi.fn().mockReturnValue([]),
      findBySessionId: vi.fn().mockReturnValue([]),
      findByDateRange: vi.fn().mockReturnValue([]),
    };

    const tickets: TicketRepository = {
      create: vi.fn() as never,
      findAll: vi.fn().mockReturnValue([]),
      findById: vi.fn().mockReturnValue(undefined),
      update: vi.fn() as never,
      delete: vi.fn() as never,
    };

    const gen = new StandupGenerator(ticketActivity, tickets, mockLogger());
    const report = gen.generate();

    expect(report.sections).toHaveLength(0);
    expect(report.markdown).toContain("No activity");
    expect(report.periodHours).toBe(24);
  });

  it("groups activities by project and type", () => {
    const now = new Date();
    const recentTimestamp = new Date(now.getTime() - 1000 * 60 * 30).toISOString(); // 30 min ago

    const activities: TicketActivity[] = [
      makeActivity({ id: 1, ticketId: 1, action: "created", timestamp: recentTimestamp }),
      makeActivity({ id: 2, ticketId: 1, action: "updated", timestamp: recentTimestamp }),
      makeActivity({ id: 3, ticketId: 2, action: "stage_changed", timestamp: recentTimestamp }),
      makeActivity({ id: 4, ticketId: 1, action: "viewed", timestamp: recentTimestamp }),
    ];

    const ticketActivity: TicketActivityRepository = {
      create: vi.fn() as never,
      findAll: vi.fn().mockReturnValue(activities),
      findByTicketId: vi.fn().mockReturnValue([]),
      findBySessionId: vi.fn().mockReturnValue([]),
      findByDateRange: vi.fn().mockReturnValue(activities),
    };

    const ticketList: Ticket[] = [
      { id: 1, title: "Ticket A", stage: "open", projectId: 10, createdAt: recentTimestamp, updatedAt: recentTimestamp },
      { id: 2, title: "Ticket B", stage: "open", projectId: 10, createdAt: recentTimestamp, updatedAt: recentTimestamp },
    ];

    const tickets: TicketRepository = {
      create: vi.fn() as never,
      findAll: vi.fn().mockReturnValue(ticketList),
      findById: vi.fn((id: number) => ticketList.find(t => t.id === id)),
      update: vi.fn() as never,
      delete: vi.fn() as never,
    };

    const gen = new StandupGenerator(ticketActivity, tickets, mockLogger());
    const report = gen.generate({ hours: 24 });

    expect(report.sections).toHaveLength(1);
    expect(report.sections[0]!.created).toHaveLength(1);
    expect(report.sections[0]!.updated).toHaveLength(1);
    expect(report.sections[0]!.stageChanged).toHaveLength(1);
    expect(report.markdown).toContain("Created");
    expect(report.markdown).toContain("Stage changes");
  });

  it("applies custom template", () => {
    const now = new Date();
    const recentTimestamp = new Date(now.getTime() - 1000 * 60 * 10).toISOString();

    const activities: TicketActivity[] = [
      makeActivity({ id: 1, ticketId: 1, action: "created", timestamp: recentTimestamp }),
    ];

    const ticketActivity: TicketActivityRepository = {
      create: vi.fn() as never,
      findAll: vi.fn().mockReturnValue(activities),
      findByTicketId: vi.fn().mockReturnValue([]),
      findBySessionId: vi.fn().mockReturnValue([]),
      findByDateRange: vi.fn().mockReturnValue(activities),
    };

    const tickets: TicketRepository = {
      create: vi.fn() as never,
      findAll: vi.fn().mockReturnValue([
        { id: 1, title: "T", stage: "open" as const, projectId: null, createdAt: recentTimestamp, updatedAt: recentTimestamp },
      ]),
      findById: vi.fn().mockReturnValue(undefined),
      update: vi.fn() as never,
      delete: vi.fn() as never,
    };

    const gen = new StandupGenerator(ticketActivity, tickets, mockLogger());
    const report = gen.generate({ template: "Created {{totalCreated}} in {{hours}}h" });

    expect(report.markdown).toBe("Created 1 in 24h");
  });
});
