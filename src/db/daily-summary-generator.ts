import type { DailySummaryGenerator, DailySummary, TicketActivityRepository, TicketRepository, AgentRunRepository, TicketAction } from "./types.js";
import type { Logger } from "../logger.js";

export class DatabaseDailySummaryGenerator implements DailySummaryGenerator {
  constructor(
    private readonly ticketActivity: TicketActivityRepository,
    private readonly tickets: TicketRepository,
    private readonly agentRuns: AgentRunRepository,
    private readonly logger: Logger
  ) {}

  async generateSummary(date: string): Promise<DailySummary> {
    const startDate = date;
    const endDate = date;

    try {
      // Get all activities for the date
      const activities = this.ticketActivity.findByDateRange(startDate, endDate);
      
      // Get all tickets (for checking current state)
      const allTickets = this.tickets.findAll();
      
      // Get all agent runs for the date
      const agentRuns = this.agentRuns.findAll().filter(run => {
        const runDate = run.startedAt.split('T')[0]; // Extract YYYY-MM-DD
        return runDate === date;
      });

      // Count activities by action
      const activityCounts: Record<TicketAction, number> = {
        viewed: 0,
        created: 0,
        updated: 0,
        deleted: 0,
        stage_changed: 0
      };

      activities.forEach(activity => {
        activityCounts[activity.action]++;
      });

      // Get unique session IDs
      const uniqueSessions = Array.from(new Set(activities.map(a => a.sessionId)));

      // Count tickets by state based on activities
      const ticketCounts = {
        created: activityCounts.created,
        updated: activityCounts.updated + activityCounts.stage_changed,
        completed: this.countCompletedTickets(activities, allTickets),
        deleted: activityCounts.deleted
      };

      // Generate effort bullets
      const effortBullets = this.generateEffortBullets(
        ticketCounts,
        uniqueSessions,
        agentRuns,
        activities
      );

      const summary: DailySummary = {
        date,
        tickets: ticketCounts,
        sessions: {
          total: uniqueSessions.length,
          unique: uniqueSessions
        },
        activities: {
          total: activities.length,
          byAction: activityCounts
        },
        effortBullets
      };

      this.logger.debug({ date, summary }, "Generated daily summary");
      return summary;
    } catch (error) {
      this.logger.error({ error, date }, "Failed to generate daily summary");
      throw new Error(`Failed to generate daily summary for ${date}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private countCompletedTickets(activities: any[], allTickets: any[]): number {
    // Count tickets that were moved to 'done' stage during the day
    const completedCount = activities
      .filter(activity => 
        activity.action === 'stage_changed' && 
        activity.metadata && 
        JSON.parse(activity.metadata).newStage === 'done'
      )
      .length;

    return completedCount;
  }

  private generateEffortBullets(
    ticketCounts: any,
    sessions: string[],
    agentRuns: any[],
    activities: any[]
  ): string[] {
    const bullets: string[] = [];

    // Ticket activity bullets
    if (ticketCounts.created > 0) {
      bullets.push(`• Created ${ticketCounts.created} new ticket${ticketCounts.created > 1 ? 's' : ''}`);
    }

    if (ticketCounts.updated > 0) {
      bullets.push(`• Updated ${ticketCounts.updated} ticket${ticketCounts.updated > 1 ? 's' : ''}`);
    }

    if (ticketCounts.completed > 0) {
      bullets.push(`• Completed ${ticketCounts.completed} ticket${ticketCounts.completed > 1 ? 's' : ''}`);
    }

    if (ticketCounts.deleted > 0) {
      bullets.push(`• Removed ${ticketCounts.deleted} ticket${ticketCounts.deleted > 1 ? 's' : ''}`);
    }

    // Session activity bullets
    if (sessions.length > 0) {
      bullets.push(`• Active in ${sessions.length} session${sessions.length > 1 ? 's' : ''}`);
    }

    // Agent run bullets
    const completedRuns = agentRuns.filter(run => run.status === 'completed').length;
    const failedRuns = agentRuns.filter(run => run.status === 'failed').length;

    if (completedRuns > 0) {
      bullets.push(`• Ran ${completedRuns} agent task${completedRuns > 1 ? 's' : ''} successfully`);
    }

    if (failedRuns > 0) {
      bullets.push(`• ${failedRuns} agent task${failedRuns > 1 ? 's' : ''} failed`);
    }

    // Activity intensity bullets
    const totalActivities = activities.length;
    if (totalActivities > 20) {
      bullets.push(`• High activity day: ${totalActivities} total actions`);
    } else if (totalActivities > 10) {
      bullets.push(`• Moderate activity: ${totalActivities} total actions`);
    } else if (totalActivities > 0) {
      bullets.push(`• Light activity: ${totalActivities} total actions`);
    }

    // Most active session
    if (sessions.length > 1) {
      const sessionActivityCounts = new Map<string, number>();
      activities.forEach(activity => {
        const count = sessionActivityCounts.get(activity.sessionId) || 0;
        sessionActivityCounts.set(activity.sessionId, count + 1);
      });

      const mostActiveSession = Array.from(sessionActivityCounts.entries())
        .sort(([,a], [,b]) => b - a)[0];

      if (mostActiveSession && mostActiveSession[1] > 1) {
        bullets.push(`• Most active session: ${mostActiveSession[0]} (${mostActiveSession[1]} actions)`);
      }
    }

    // Add default bullet if no activity
    if (bullets.length === 0) {
      bullets.push('• No activity recorded');
    }

    return bullets;
  }
}