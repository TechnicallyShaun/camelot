import type { AcceptanceCriterion, AcceptanceTestExecutor, AcceptanceTestResult, AcceptanceTestSummary } from "./types.js";
import { parseAcceptanceCriteria } from "./ac-parser.js";
import type { Logger } from "../logger.js";

export interface AcceptanceTestRunnerDeps {
  readonly executor: AcceptanceTestExecutor;
  readonly logger: Logger;
}

export class AcceptanceTestRunner {
  constructor(private readonly deps: AcceptanceTestRunnerDeps) {}

  async run(ticketId: string, ticketTitle: string, description: string, navigationSkill?: string): Promise<AcceptanceTestSummary> {
    const criteria = parseAcceptanceCriteria(description);

    if (criteria.length === 0) {
      return {
        ticketId, ticketTitle, generatedAt: new Date().toISOString(),
        criteria, results: [], passed: 0, failed: 0, skipped: 0, errors: 0,
        markdown: `# Acceptance Test: ${ticketTitle}\n\n⚠️ No acceptance criteria found in ticket description`,
      };
    }

    const results: AcceptanceTestResult[] = [];

    for (const criterion of criteria) {
      this.deps.logger.info({ ticketId, criterionId: criterion.id }, "Running acceptance test");
      try {
        const result = await this.deps.executor.execute(criterion, navigationSkill);
        results.push(result);
      } catch (error) {
        results.push({
          criterionId: criterion.id, criterion, status: "error",
          message: error instanceof Error ? error.message : "Unknown error", durationMs: 0,
        });
      }
    }

    const passed = results.filter(r => r.status === "pass").length;
    const failed = results.filter(r => r.status === "fail").length;
    const skipped = results.filter(r => r.status === "skip").length;
    const errors = results.filter(r => r.status === "error").length;

    const lines: string[] = [
      `# Acceptance Test: ${ticketTitle}`, "",
      `**Ticket:** ${ticketId}`,
      `**Results:** ${passed} passed, ${failed} failed, ${skipped} skipped, ${errors} errors`, "",
    ];

    for (const r of results) {
      const icon = r.status === "pass" ? "✅" : r.status === "fail" ? "❌" : r.status === "skip" ? "⏭️" : "💥";
      lines.push(`## ${icon} ${r.criterionId}`);
      lines.push(`**Given** ${r.criterion.given}`);
      lines.push(`**When** ${r.criterion.when}`);
      lines.push(`**Then** ${r.criterion.then}`, "");
      lines.push(`**Status:** ${r.status} — ${r.message}`);
      if (r.durationMs > 0) lines.push(`**Duration:** ${r.durationMs}ms`);
      if (r.evidence?.length) { lines.push("**Evidence:**"); for (const e of r.evidence) lines.push(`- ${e}`); }
      lines.push("");
    }

    return { ticketId, ticketTitle, generatedAt: new Date().toISOString(), criteria, results, passed, failed, skipped, errors, markdown: lines.join("\n") };
  }
}

export class StubAcceptanceTestExecutor implements AcceptanceTestExecutor {
  async execute(criterion: AcceptanceCriterion): Promise<AcceptanceTestResult> {
    return { criterionId: criterion.id, criterion, status: "skip", message: "No browser automation configured — stub executor", durationMs: 0 };
  }
}
