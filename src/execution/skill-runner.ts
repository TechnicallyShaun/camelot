import type { SkillRepository, ToolRepository } from "../db/types.js";
import { parseStructuredContent } from "./content-parser.js";
import { ToolExecutor } from "./tool-executor.js";
import type { SkillExecutionResult } from "./types.js";

interface SkillStepDefinition {
  readonly id?: string;
  readonly toolId: string;
  readonly params?: Record<string, unknown>;
}

interface SkillProfile {
  readonly params?: Record<string, unknown>;
  readonly stepParams?: Record<string, Record<string, unknown>>;
}

interface SkillDefinition {
  readonly steps: SkillStepDefinition[];
  readonly params?: Record<string, unknown>;
  readonly profiles?: Record<string, SkillProfile>;
}

export interface SkillRunnerOptions {
  readonly profile?: string;
  readonly params?: Record<string, unknown>;
}

export interface SkillRunnerDeps {
  readonly skills: SkillRepository;
  readonly tools: ToolRepository;
  readonly toolExecutor: ToolExecutor;
}

export class SkillRunner {
  constructor(private readonly deps: SkillRunnerDeps) {}

  async executeSkill(skillId: string, options: SkillRunnerOptions = {}): Promise<SkillExecutionResult> {
    const skill = this.deps.skills.findById(skillId);
    if (!skill) {
      return {
        success: false,
        profile: options.profile,
        steps: [],
        output: [],
        error: `Skill ${skillId} not found`,
      };
    }

    const definition = this.parseSkillDefinition(skill.content);
    const profileConfig = options.profile ? definition.profiles?.[options.profile] : undefined;

    if (options.profile && !profileConfig) {
      return {
        success: false,
        profile: options.profile,
        steps: [],
        output: [],
        error: `Profile ${options.profile} not found for skill ${skill.name}`,
      };
    }

    const stepResults: SkillExecutionResult["steps"] = [];
    const output: unknown[] = [];

    for (let index = 0; index < definition.steps.length; index += 1) {
      const step = definition.steps[index];
      const tool = this.deps.tools.findById(step.toolId);

      if (!tool) {
        return {
          success: false,
          profile: options.profile,
          steps: stepResults,
          output,
          error: `Tool ${step.toolId} not found for step ${step.id ?? index + 1}`,
        };
      }

      const stepId = step.id ?? `step-${index + 1}`;
      const mergedParams: Record<string, unknown> = {
        ...(definition.params ?? {}),
        ...(profileConfig?.params ?? {}),
        ...(step.params ?? {}),
        ...(profileConfig?.stepParams?.[stepId] ?? {}),
        ...(options.params ?? {}),
      };

      const result = await this.deps.toolExecutor.execute({
        tool,
        params: mergedParams,
        profile: options.profile,
      });

      stepResults.push({
        stepId,
        toolId: tool.id,
        result,
      });
      output.push(result.output);

      if (!result.success) {
        return {
          success: false,
          profile: options.profile,
          steps: stepResults,
          output,
          error: result.error ?? `Step ${stepId} failed`,
        };
      }
    }

    return {
      success: true,
      profile: options.profile,
      steps: stepResults,
      output,
    };
  }

  private parseSkillDefinition(content: string): SkillDefinition {
    const parsed = parseStructuredContent(content);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid skill definition: expected object");
    }

    const steps = (parsed as Record<string, unknown>).steps;
    if (!Array.isArray(steps)) {
      throw new Error("Invalid skill definition: steps array is required");
    }

    return parsed as SkillDefinition;
  }
}
