import type { Skill, Tool } from "../db/types.js";

export interface ExecutionResult {
  readonly success: boolean;
  readonly output: unknown;
  readonly error?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ToolExecutionContext {
  readonly tool: Tool;
  readonly params: Record<string, unknown>;
  readonly profile?: string;
}

export interface SkillStepExecutionResult {
  readonly stepId: string;
  readonly toolId: string;
  readonly result: ExecutionResult;
}

export interface SkillExecutionContext {
  readonly skill: Skill;
  readonly profile?: string;
  readonly params?: Record<string, unknown>;
}

export interface SkillExecutionResult {
  readonly success: boolean;
  readonly profile?: string;
  readonly steps: SkillStepExecutionResult[];
  readonly output: unknown[];
  readonly error?: string;
}
