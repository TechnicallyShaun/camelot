import { describe, it, expect, vi } from "vitest";
import { AcceptanceTestRunner, StubAcceptanceTestExecutor } from "./test-runner.js";
import { parseAcceptanceCriteria } from "./ac-parser.js";
import type { Logger } from "../logger.js";

function mockLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis(), level: "silent", silent: vi.fn() } as unknown as Logger;
}

describe("parseAcceptanceCriteria", () => {
  it("parses Given/When/Then format", () => {
    const criteria = parseAcceptanceCriteria("Given the user is logged in\nWhen they click dashboard\nThen they see the dashboard");
    expect(criteria).toHaveLength(1);
    expect(criteria[0]!.given).toBe("the user is logged in");
    expect(criteria[0]!.when).toBe("they click dashboard");
    expect(criteria[0]!.then).toBe("they see the dashboard");
  });

  it("parses bullet-point AC", () => {
    const criteria = parseAcceptanceCriteria("## Acceptance Criteria\n- Page loads fast\n- Error messages in red");
    expect(criteria).toHaveLength(2);
    expect(criteria[0]!.then).toBe("Page loads fast");
  });

  it("returns empty for no AC", () => {
    expect(parseAcceptanceCriteria("Just a description.")).toHaveLength(0);
  });
});

describe("AcceptanceTestRunner", () => {
  it("runs with stub executor", async () => {
    const runner = new AcceptanceTestRunner({ executor: new StubAcceptanceTestExecutor(), logger: mockLogger() });
    const summary = await runner.run("T-1", "Test", "## Acceptance Criteria\n- Button exists\n- Page loads");
    expect(summary.skipped).toBe(2);
    expect(summary.passed).toBe(0);
    expect(summary.markdown).toContain("Acceptance Test");
  });

  it("handles no AC", async () => {
    const runner = new AcceptanceTestRunner({ executor: new StubAcceptanceTestExecutor(), logger: mockLogger() });
    const summary = await runner.run("T-2", "No AC", "Just a description");
    expect(summary.criteria).toHaveLength(0);
    expect(summary.markdown).toContain("No acceptance criteria");
  });
});
