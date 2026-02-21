import { describe, it, expect, vi } from "vitest";
import type { SkillRepository, ToolRepository } from "../db/types.js";
import { SkillRunner } from "./skill-runner.js";
import type { ToolExecutor } from "./tool-executor.js";

const now = new Date().toISOString();

describe("SkillRunner", () => {
  it("executes steps sequentially", async () => {
    const skills: SkillRepository = {
      create: vi.fn(),
      findAll: vi.fn().mockReturnValue([]),
      findById: vi.fn().mockReturnValue({
        id: "skill-1",
        name: "Skill",
        description: "",
        fileName: "skill.json",
        content: JSON.stringify({
          steps: [
            { id: "first", toolId: "tool-1", params: { a: 1 } },
            { id: "second", toolId: "tool-2", params: { b: 2 } },
          ],
        }),
        createdAt: now,
        updatedAt: now,
      }),
      findByFileName: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      syncFromFileSystem: vi.fn(),
    };

    const tools: ToolRepository = {
      create: vi.fn(),
      findAll: vi.fn().mockReturnValue([]),
      findById: vi.fn((id: string) => ({
        id,
        name: id,
        description: "",
        fileName: `${id}.json`,
        content: JSON.stringify({ type: "shell", command: "echo ok" }),
        createdAt: now,
        updatedAt: now,
      })),
      findByFileName: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      syncFromFileSystem: vi.fn(),
    };

    const execute = vi
      .fn()
      .mockResolvedValueOnce({ success: true, output: "one" })
      .mockResolvedValueOnce({ success: true, output: "two" });

    const runner = new SkillRunner({
      skills,
      tools,
      toolExecutor: { execute } as unknown as ToolExecutor,
    });

    const result = await runner.executeSkill("skill-1");

    expect(result.success).toBe(true);
    expect(result.output).toEqual(["one", "two"]);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("applies profile parameters", async () => {
    const skills: SkillRepository = {
      create: vi.fn(),
      findAll: vi.fn().mockReturnValue([]),
      findById: vi.fn().mockReturnValue({
        id: "skill-1",
        name: "Skill",
        description: "",
        fileName: "skill.json",
        content: JSON.stringify({
          steps: [{ id: "build", toolId: "tool-1", params: { mode: "default" } }],
          profiles: {
            fast: {
              params: { retries: 1 },
              stepParams: {
                build: { mode: "fast" },
              },
            },
          },
        }),
        createdAt: now,
        updatedAt: now,
      }),
      findByFileName: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      syncFromFileSystem: vi.fn(),
    };

    const tools: ToolRepository = {
      create: vi.fn(),
      findAll: vi.fn().mockReturnValue([]),
      findById: vi.fn().mockReturnValue({
        id: "tool-1",
        name: "Tool 1",
        description: "",
        fileName: "tool-1.json",
        content: JSON.stringify({ type: "shell", command: "echo ok" }),
        createdAt: now,
        updatedAt: now,
      }),
      findByFileName: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      syncFromFileSystem: vi.fn(),
    };

    const execute = vi.fn().mockResolvedValue({ success: true, output: "done" });

    const runner = new SkillRunner({
      skills,
      tools,
      toolExecutor: { execute } as unknown as ToolExecutor,
    });

    const result = await runner.executeSkill("skill-1", { profile: "fast" });

    expect(result.success).toBe(true);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.objectContaining({ mode: "fast", retries: 1 }),
      profile: "fast",
    }));
  });
});
