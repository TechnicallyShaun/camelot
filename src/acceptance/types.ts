export interface AcceptanceCriterion {
  readonly id: string;
  readonly given: string;
  readonly when: string;
  readonly then: string;
  readonly raw: string;
}

export interface AcceptanceTestResult {
  readonly criterionId: string;
  readonly criterion: AcceptanceCriterion;
  readonly status: "pass" | "fail" | "skip" | "error";
  readonly message: string;
  readonly durationMs: number;
  readonly evidence?: string[];
}

export interface AcceptanceTestSummary {
  readonly ticketId: string;
  readonly ticketTitle: string;
  readonly generatedAt: string;
  readonly criteria: AcceptanceCriterion[];
  readonly results: AcceptanceTestResult[];
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly errors: number;
  readonly markdown: string;
}

export interface AcceptanceTestExecutor {
  execute(criterion: AcceptanceCriterion, navigationSkill?: string): Promise<AcceptanceTestResult>;
}
