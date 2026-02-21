import type { TicketActivityRepository, TicketRepository, TicketActivity } from "../db/types.js";
import type { Logger } from "../logger.js";

export interface StandupConfig {
  readonly hours?: number;
  readonly projectId?: number;
  readonly template?: string;
}

export interface StandupSection {
  readonly projectId: number | null;
  readonly projectName: string;
  readonly created: TicketActivity[];
  readonly updated: TicketActivity[];
  readonly stageChanged: TicketActivity[];
  readonly deleted: TicketActivity[];
}

export interface StandupReport {
  readonly generatedAt: string;
  readonly periodHours: number;
  readonly sections: StandupSection[];
  readonly markdown: string;
}

export class StandupGenerator {
  constructor(
    private readonly ticketActivity: TicketActivityRepository,
    private readonly tickets: TicketRepository,
    private readonly logger: Logger
  ) {}

  generate(config: StandupConfig = {}): StandupReport {
    const hours = config.hours ?? 24;
    const now = new Date();
    const since = new Date(now.getTime() - hours * 60 * 60 * 1000);

    const sinceDate = since.toISOString().split("T")[0]!;
    const untilDate = now.toISOString().split("T")[0]!;

    const activities = this.ticketActivity.findByDateRange(sinceDate, untilDate)
      .filter(a => new Date(a.timestamp) >= since);

    if (config.projectId !== undefined) {
      const ticket = this.tickets.findById(config.projectId);
      if (!ticket) {
        this.logger.warn({ projectId: config.projectId }, "Standup filter: project ticket not found");
      }
    }

    // Group activities by ticket → resolve project
    const ticketMap = new Map<number, { projectId: number | null; projectName: string }>();
    const allTickets = this.tickets.findAll();
    for (const t of allTickets) {
      ticketMap.set(t.id, {
        projectId: t.projectId,
        projectName: t.projectId !== null ? `Project ${t.projectId}` : "Unassigned",
      });
    }

    // Group by project
    const projectGroups = new Map<number | null, {
      created: TicketActivity[];
      updated: TicketActivity[];
      stageChanged: TicketActivity[];
      deleted: TicketActivity[];
    }>();

    for (const activity of activities) {
      const info = ticketMap.get(activity.ticketId);
      const projectId = info?.projectId ?? null;

      if (config.projectId !== undefined && projectId !== config.projectId) {
        continue;
      }

      if (!projectGroups.has(projectId)) {
        projectGroups.set(projectId, { created: [], updated: [], stageChanged: [], deleted: [] });
      }

      const group = projectGroups.get(projectId)!;
      switch (activity.action) {
        case "created":
          group.created.push(activity);
          break;
        case "updated":
          group.updated.push(activity);
          break;
        case "stage_changed":
          group.stageChanged.push(activity);
          break;
        case "deleted":
          group.deleted.push(activity);
          break;
        // "viewed" is noise — skip
      }
    }

    const sections: StandupSection[] = [];
    for (const [projectId, group] of projectGroups) {
      const info = projectId !== null
        ? (ticketMap.values().next().value ?? { projectName: `Project ${projectId}` })
        : { projectName: "Unassigned" };

      // Find the actual project name from tickets in this group
      const projectName = projectId !== null ? `Project ${projectId}` : "Unassigned";

      sections.push({
        projectId,
        projectName,
        ...group,
      });
    }

    const markdown = config.template
      ? this.applyTemplate(config.template, sections, hours)
      : this.defaultMarkdown(sections, hours);

    const report: StandupReport = {
      generatedAt: now.toISOString(),
      periodHours: hours,
      sections,
      markdown,
    };

    this.logger.debug({ hours, sectionCount: sections.length }, "Generated standup report");
    return report;
  }

  private defaultMarkdown(sections: StandupSection[], hours: number): string {
    const lines: string[] = [`# Standup Report (last ${hours}h)`, ""];

    if (sections.length === 0) {
      lines.push("No activity recorded in this period.");
      return lines.join("\n");
    }

    for (const section of sections) {
      lines.push(`## ${section.projectName}`);
      lines.push("");

      if (section.created.length > 0) {
        lines.push(`- **Created:** ${section.created.length} ticket(s)`);
      }
      if (section.updated.length > 0) {
        lines.push(`- **Updated:** ${section.updated.length} ticket(s)`);
      }
      if (section.stageChanged.length > 0) {
        lines.push(`- **Stage changes:** ${section.stageChanged.length}`);
      }
      if (section.deleted.length > 0) {
        lines.push(`- **Deleted:** ${section.deleted.length} ticket(s)`);
      }

      lines.push("");
    }

    return lines.join("\n");
  }

  private applyTemplate(template: string, sections: StandupSection[], hours: number): string {
    const totalCreated = sections.reduce((sum, s) => sum + s.created.length, 0);
    const totalUpdated = sections.reduce((sum, s) => sum + s.updated.length, 0);
    const totalStageChanged = sections.reduce((sum, s) => sum + s.stageChanged.length, 0);
    const totalDeleted = sections.reduce((sum, s) => sum + s.deleted.length, 0);

    return template
      .replace(/\{\{hours\}\}/g, String(hours))
      .replace(/\{\{totalCreated\}\}/g, String(totalCreated))
      .replace(/\{\{totalUpdated\}\}/g, String(totalUpdated))
      .replace(/\{\{totalStageChanged\}\}/g, String(totalStageChanged))
      .replace(/\{\{totalDeleted\}\}/g, String(totalDeleted))
      .replace(/\{\{sectionCount\}\}/g, String(sections.length));
  }
}
