import type { Logger } from "../logger.js";

export interface TicketForReview {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly labels?: string[];
  readonly status?: string;
  readonly assignee?: string;
}

export interface TicketReviewResult {
  readonly ticketId: string;
  readonly title: string;
  readonly size: "S" | "M" | "L" | "XL" | "Unknown";
  readonly sizeReasoning: string;
  readonly ambiguities: string[];
  readonly risks: string[];
  readonly questions: string[];
}

export interface ReviewSummary {
  readonly generatedAt: string;
  readonly ticketCount: number;
  readonly reviews: TicketReviewResult[];
  readonly markdown: string;
}

export interface TicketReviewerDeps {
  readonly logger: Logger;
}

/**
 * AI Ticket Reviewer — analyses tickets for sizing, ambiguities, and risks.
 * 
 * This is a rule-based reviewer that can be extended with AI agent integration.
 * It analyses ticket structure and content to flag issues and suggest sizing.
 */
export class TicketReviewer {
  private readonly logger: Logger;

  constructor(deps: TicketReviewerDeps) {
    this.logger = deps.logger;
  }

  review(tickets: TicketForReview[]): ReviewSummary {
    const reviews = tickets.map(ticket => this.reviewTicket(ticket));

    const markdown = this.generateMarkdown(reviews);

    this.logger.debug({ ticketCount: tickets.length }, "Generated ticket review summary");

    return {
      generatedAt: new Date().toISOString(),
      ticketCount: tickets.length,
      reviews,
      markdown,
    };
  }

  private reviewTicket(ticket: TicketForReview): TicketReviewResult {
    const ambiguities: string[] = [];
    const risks: string[] = [];
    const questions: string[] = [];

    const desc = ticket.description ?? "";
    const descLength = desc.length;
    const hasAcceptanceCriteria = /acceptance\s*criteria|given\s+.*when\s+.*then|## AC|## Acceptance/i.test(desc);
    const hasDependencies = /depend|requires|blocked|prerequisite/i.test(desc);
    const hasApiChanges = /api|endpoint|route|REST|GraphQL/i.test(desc);
    const hasDbChanges = /database|migration|schema|table|column/i.test(desc);
    const hasSecurityConcerns = /auth|permission|role|security|token|encrypt/i.test(desc);

    // Ambiguity detection
    if (descLength < 50) {
      ambiguities.push("Very short description — likely missing detail");
    }
    if (!hasAcceptanceCriteria) {
      ambiguities.push("No acceptance criteria found");
    }
    if (desc.includes("TBD") || desc.includes("TODO") || desc.includes("???")) {
      ambiguities.push("Contains TBD/TODO markers — incomplete requirements");
    }
    if (/should|might|maybe|possibly|could/i.test(desc)) {
      ambiguities.push("Vague language detected (should/might/maybe)");
    }

    // Risk detection
    if (hasDependencies) {
      risks.push("Has dependency references — verify availability");
    }
    if (hasDbChanges) {
      risks.push("Database changes detected — migration planning needed");
    }
    if (hasSecurityConcerns) {
      risks.push("Security-related changes — may need review from security team");
    }
    if (hasApiChanges && !hasAcceptanceCriteria) {
      risks.push("API changes without acceptance criteria — contract risk");
    }

    // Questions
    if (!hasAcceptanceCriteria) {
      questions.push("What are the acceptance criteria for this ticket?");
    }
    if (hasApiChanges) {
      questions.push("Are there existing consumers of the affected API(s)?");
    }
    if (hasDependencies) {
      questions.push("Are all dependencies available and in a ready state?");
    }
    if (descLength < 100 && !hasAcceptanceCriteria) {
      questions.push("Can the requirements be expanded before development starts?");
    }

    // Sizing heuristic
    const size = this.estimateSize(descLength, ambiguities.length, risks.length, hasDbChanges, hasApiChanges);

    return {
      ticketId: ticket.id,
      title: ticket.title,
      size,
      sizeReasoning: this.sizeReasoning(size, descLength, ambiguities.length, risks.length),
      ambiguities,
      risks,
      questions,
    };
  }

  private estimateSize(
    descLength: number,
    ambiguityCount: number,
    riskCount: number,
    hasDbChanges: boolean,
    hasApiChanges: boolean
  ): "S" | "M" | "L" | "XL" | "Unknown" {
    if (ambiguityCount >= 3) return "Unknown";

    let complexity = 0;
    if (descLength > 500) complexity += 2;
    else if (descLength > 200) complexity += 1;

    if (hasDbChanges) complexity += 2;
    if (hasApiChanges) complexity += 1;
    complexity += riskCount;

    if (complexity >= 5) return "XL";
    if (complexity >= 3) return "L";
    if (complexity >= 1) return "M";
    return "S";
  }

  private sizeReasoning(size: string, descLength: number, ambiguityCount: number, riskCount: number): string {
    if (size === "Unknown") {
      return `Too many ambiguities (${ambiguityCount}) to estimate reliably. Clarify requirements first.`;
    }
    const factors: string[] = [];
    if (descLength > 500) factors.push("detailed requirements");
    else if (descLength < 100) factors.push("minimal requirements");
    if (riskCount > 0) factors.push(`${riskCount} risk(s) identified`);
    if (ambiguityCount > 0) factors.push(`${ambiguityCount} ambiguity(ies)`);

    return factors.length > 0
      ? `Estimated ${size} based on: ${factors.join(", ")}`
      : `Estimated ${size} — straightforward scope`;
  }

  private generateMarkdown(reviews: TicketReviewResult[]): string {
    const lines: string[] = ["# Ticket Review Summary", ""];

    if (reviews.length === 0) {
      lines.push("No tickets to review.");
      return lines.join("\n");
    }

    // Size distribution
    const sizes: Record<string, number> = {};
    for (const r of reviews) {
      sizes[r.size] = (sizes[r.size] ?? 0) + 1;
    }
    lines.push("## Size Distribution");
    for (const [size, count] of Object.entries(sizes)) {
      lines.push(`- **${size}**: ${count}`);
    }
    lines.push("");

    // Per-ticket detail
    for (const r of reviews) {
      lines.push(`## ${r.ticketId}: ${r.title}`);
      lines.push(`**Size:** ${r.size} — ${r.sizeReasoning}`);
      lines.push("");

      if (r.ambiguities.length > 0) {
        lines.push("### ⚠️ Ambiguities");
        for (const a of r.ambiguities) lines.push(`- ${a}`);
        lines.push("");
      }

      if (r.risks.length > 0) {
        lines.push("### 🚨 Risks");
        for (const risk of r.risks) lines.push(`- ${risk}`);
        lines.push("");
      }

      if (r.questions.length > 0) {
        lines.push("### ❓ Questions for Stakeholders");
        for (const q of r.questions) lines.push(`- ${q}`);
        lines.push("");
      }
    }

    return lines.join("\n");
  }
}
