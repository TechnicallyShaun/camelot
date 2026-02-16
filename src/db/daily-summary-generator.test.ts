import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseDailySummaryGenerator } from './daily-summary-generator.js';
import type { TicketActivityRepository, TicketRepository, AgentRunRepository, TicketActivity, Ticket, AgentRun } from './types.js';
import type { Logger } from '../logger.js';

describe('DatabaseDailySummaryGenerator', () => {
  let mockTicketActivity: TicketActivityRepository;
  let mockTickets: TicketRepository;
  let mockAgentRuns: AgentRunRepository;
  let mockLogger: Logger;
  let generator: DatabaseDailySummaryGenerator;

  const testDate = '2024-01-15';

  beforeEach(() => {
    vi.clearAllMocks();

    mockTicketActivity = {
      create: vi.fn(),
      findAll: vi.fn(),
      findByTicketId: vi.fn(),
      findBySessionId: vi.fn(),
      findByDateRange: vi.fn(),
    };

    mockTickets = {
      create: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn(),
      updateStage: vi.fn(),
      remove: vi.fn(),
    };

    mockAgentRuns = {
      create: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn(),
      updateStatus: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(() => mockLogger),
    };

    generator = new DatabaseDailySummaryGenerator(
      mockTicketActivity,
      mockTickets,
      mockAgentRuns,
      mockLogger
    );
  });

  it('generates basic daily summary with no activity', async () => {
    mockTicketActivity.findByDateRange = vi.fn().mockReturnValue([]);
    mockTickets.findAll = vi.fn().mockReturnValue([]);
    mockAgentRuns.findAll = vi.fn().mockReturnValue([]);

    const summary = await generator.generateSummary(testDate);

    expect(summary).toEqual({
      date: testDate,
      tickets: {
        created: 0,
        updated: 0,
        completed: 0,
        deleted: 0,
      },
      sessions: {
        total: 0,
        unique: [],
      },
      activities: {
        total: 0,
        byAction: {
          viewed: 0,
          created: 0,
          updated: 0,
          deleted: 0,
          stage_changed: 0,
        },
      },
      effortBullets: ['• No activity recorded'],
    });
  });

  it('generates summary with ticket activities', async () => {
    const activities: TicketActivity[] = [
      {
        id: 1,
        ticketId: 101,
        sessionId: 'session-1',
        action: 'created',
        timestamp: '2024-01-15T10:00:00Z',
      },
      {
        id: 2,
        ticketId: 102,
        sessionId: 'session-1',
        action: 'viewed',
        timestamp: '2024-01-15T10:30:00Z',
      },
      {
        id: 3,
        ticketId: 101,
        sessionId: 'session-2',
        action: 'stage_changed',
        timestamp: '2024-01-15T11:00:00Z',
        metadata: JSON.stringify({ newStage: 'done' }),
      },
      {
        id: 4,
        ticketId: 103,
        sessionId: 'session-2',
        action: 'deleted',
        timestamp: '2024-01-15T11:30:00Z',
      },
    ];

    mockTicketActivity.findByDateRange = vi.fn().mockReturnValue(activities);
    mockTickets.findAll = vi.fn().mockReturnValue([]);
    mockAgentRuns.findAll = vi.fn().mockReturnValue([]);

    const summary = await generator.generateSummary(testDate);

    expect(summary.tickets).toEqual({
      created: 1,
      updated: 1, // stage_changed counts as updated
      completed: 1,
      deleted: 1,
    });

    expect(summary.sessions).toEqual({
      total: 2,
      unique: ['session-1', 'session-2'],
    });

    expect(summary.activities.total).toBe(4);
    expect(summary.activities.byAction.created).toBe(1);
    expect(summary.activities.byAction.viewed).toBe(1);
    expect(summary.activities.byAction.stage_changed).toBe(1);
    expect(summary.activities.byAction.deleted).toBe(1);

    expect(summary.effortBullets).toContain('• Created 1 new ticket');
    expect(summary.effortBullets).toContain('• Updated 1 ticket');
    expect(summary.effortBullets).toContain('• Completed 1 ticket');
    expect(summary.effortBullets).toContain('• Removed 1 ticket');
    expect(summary.effortBullets).toContain('• Active in 2 sessions');
  });

  it('generates summary with agent runs', async () => {
    const agentRuns: AgentRun[] = [
      {
        id: 'run-1',
        agent: 'copilot',
        prompt: 'test task',
        cwd: '/test',
        model: null,
        status: 'completed',
        exitCode: 0,
        startedAt: '2024-01-15T09:00:00Z',
        finishedAt: '2024-01-15T09:05:00Z',
      },
      {
        id: 'run-2',
        agent: 'claude',
        prompt: 'another task',
        cwd: '/test',
        model: null,
        status: 'completed',
        exitCode: 0,
        startedAt: '2024-01-15T10:00:00Z',
        finishedAt: '2024-01-15T10:03:00Z',
      },
      {
        id: 'run-3',
        agent: 'copilot',
        prompt: 'failed task',
        cwd: '/test',
        model: null,
        status: 'failed',
        exitCode: 1,
        startedAt: '2024-01-15T11:00:00Z',
        finishedAt: '2024-01-15T11:01:00Z',
      },
      {
        id: 'run-4',
        agent: 'claude',
        prompt: 'different day',
        cwd: '/test',
        model: null,
        status: 'completed',
        exitCode: 0,
        startedAt: '2024-01-16T09:00:00Z', // Different day - should be filtered out
        finishedAt: '2024-01-16T09:05:00Z',
      },
    ];

    mockTicketActivity.findByDateRange = vi.fn().mockReturnValue([]);
    mockTickets.findAll = vi.fn().mockReturnValue([]);
    mockAgentRuns.findAll = vi.fn().mockReturnValue(agentRuns);

    const summary = await generator.generateSummary(testDate);

    expect(summary.effortBullets).toContain('• Ran 2 agent tasks successfully');
    expect(summary.effortBullets).toContain('• 1 agent task failed');
  });

  it('generates effort bullets for high activity', async () => {
    // Create 25 activities for high activity day
    const activities: TicketActivity[] = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      ticketId: 101,
      sessionId: 'session-1',
      action: 'viewed',
      timestamp: '2024-01-15T10:00:00Z',
    }));

    mockTicketActivity.findByDateRange = vi.fn().mockReturnValue(activities);
    mockTickets.findAll = vi.fn().mockReturnValue([]);
    mockAgentRuns.findAll = vi.fn().mockReturnValue([]);

    const summary = await generator.generateSummary(testDate);

    expect(summary.effortBullets).toContain('• High activity day: 25 total actions');
  });

  it('generates effort bullets for moderate activity', async () => {
    // Create 15 activities for moderate activity day
    const activities: TicketActivity[] = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      ticketId: 101,
      sessionId: 'session-1',
      action: 'viewed',
      timestamp: '2024-01-15T10:00:00Z',
    }));

    mockTicketActivity.findByDateRange = vi.fn().mockReturnValue(activities);
    mockTickets.findAll = vi.fn().mockReturnValue([]);
    mockAgentRuns.findAll = vi.fn().mockReturnValue([]);

    const summary = await generator.generateSummary(testDate);

    expect(summary.effortBullets).toContain('• Moderate activity: 15 total actions');
  });

  it('identifies most active session', async () => {
    const activities: TicketActivity[] = [
      { id: 1, ticketId: 101, sessionId: 'session-1', action: 'viewed', timestamp: '2024-01-15T10:00:00Z' },
      { id: 2, ticketId: 102, sessionId: 'session-1', action: 'viewed', timestamp: '2024-01-15T10:30:00Z' },
      { id: 3, ticketId: 103, sessionId: 'session-1', action: 'viewed', timestamp: '2024-01-15T11:00:00Z' },
      { id: 4, ticketId: 104, sessionId: 'session-2', action: 'viewed', timestamp: '2024-01-15T11:30:00Z' },
      { id: 5, ticketId: 105, sessionId: 'session-2', action: 'viewed', timestamp: '2024-01-15T12:00:00Z' },
    ];

    mockTicketActivity.findByDateRange = vi.fn().mockReturnValue(activities);
    mockTickets.findAll = vi.fn().mockReturnValue([]);
    mockAgentRuns.findAll = vi.fn().mockReturnValue([]);

    const summary = await generator.generateSummary(testDate);

    expect(summary.effortBullets).toContain('• Most active session: session-1 (3 actions)');
  });

  it('handles plural forms correctly', async () => {
    const activities: TicketActivity[] = [
      { id: 1, ticketId: 101, sessionId: 'session-1', action: 'created', timestamp: '2024-01-15T10:00:00Z' },
      { id: 2, ticketId: 102, sessionId: 'session-1', action: 'created', timestamp: '2024-01-15T10:30:00Z' },
      { id: 3, ticketId: 101, sessionId: 'session-2', action: 'updated', timestamp: '2024-01-15T11:00:00Z' },
      { id: 4, ticketId: 102, sessionId: 'session-2', action: 'updated', timestamp: '2024-01-15T11:30:00Z' },
    ];

    mockTicketActivity.findByDateRange = vi.fn().mockReturnValue(activities);
    mockTickets.findAll = vi.fn().mockReturnValue([]);
    mockAgentRuns.findAll = vi.fn().mockReturnValue([]);

    const summary = await generator.generateSummary(testDate);

    expect(summary.effortBullets).toContain('• Created 2 new tickets');
    expect(summary.effortBullets).toContain('• Updated 2 tickets');
    expect(summary.effortBullets).toContain('• Active in 2 sessions');
  });

  it('handles errors gracefully', async () => {
    mockTicketActivity.findByDateRange = vi.fn().mockImplementation(() => {
      throw new Error('Database error');
    });

    await expect(generator.generateSummary(testDate)).rejects.toThrow(
      'Failed to generate daily summary for 2024-01-15: Database error'
    );

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Failed to generate daily summary'
    );
  });

  it('calls repositories with correct date range', async () => {
    mockTicketActivity.findByDateRange = vi.fn().mockReturnValue([]);
    mockTickets.findAll = vi.fn().mockReturnValue([]);
    mockAgentRuns.findAll = vi.fn().mockReturnValue([]);

    await generator.generateSummary(testDate);

    expect(mockTicketActivity.findByDateRange).toHaveBeenCalledWith(testDate, testDate);
  });
});