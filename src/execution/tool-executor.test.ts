import { describe, it, expect, vi } from "vitest";
import type { ServiceRepository, Tool } from "../db/types.js";
import { ToolExecutor } from "./tool-executor.js";

function createTool(content: string): Tool {
  const now = new Date().toISOString();
  return {
    id: "tool-1",
    name: "Test Tool",
    description: "",
    fileName: "test-tool.json",
    content,
    createdAt: now,
    updatedAt: now,
  };
}

describe("ToolExecutor", () => {
  it("executes shell tools", async () => {
    const services: ServiceRepository = {
      create: vi.fn(),
      findAll: vi.fn().mockReturnValue([]),
      findById: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    const execCommand = vi.fn().mockReturnValue("hello shaun\n");
    const executor = new ToolExecutor({ services, execCommand });

    const result = await executor.execute({
      tool: createTool(JSON.stringify({ type: "shell", command: "echo hello {{name}}" })),
      params: { name: "shaun" },
    });

    expect(result.success).toBe(true);
    expect(result.output).toBe("hello shaun\n");
    expect(execCommand).toHaveBeenCalledWith("echo hello shaun", undefined);
  });

  it("executes http tools and resolves service config", async () => {
    const services: ServiceRepository = {
      create: vi.fn(),
      findAll: vi.fn().mockReturnValue([]),
      findById: vi.fn().mockReturnValue({
        id: "svc-1",
        name: "Service",
        description: "",
        provider: "",
        baseUrl: "https://api.example.com",
        authType: "none",
        status: "active",
        createdAt: "now",
        updatedAt: "now",
      }),
      update: vi.fn(),
      remove: vi.fn(),
    };

    const httpRequest = vi.fn().mockResolvedValue({ ok: true });
    const executor = new ToolExecutor({ services, httpRequest });

    const result = await executor.execute({
      tool: createTool(JSON.stringify({
        type: "http",
        serviceId: "svc-1",
        method: "POST",
        path: "/v1/tasks/{{taskId}}",
        body: { type: "sync" },
      })),
      params: { taskId: "92" },
    });

    expect(result.success).toBe(true);
    expect(httpRequest).toHaveBeenCalledWith("https://api.example.com/v1/tasks/92", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "sync" }),
    });
  });

  it("returns failed result when tool execution throws", async () => {
    const services: ServiceRepository = {
      create: vi.fn(),
      findAll: vi.fn().mockReturnValue([]),
      findById: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    const execCommand = vi.fn().mockImplementation(() => {
      throw new Error("command failed");
    });

    const executor = new ToolExecutor({ services, execCommand });
    const result = await executor.execute({
      tool: createTool(JSON.stringify({ type: "shell", command: "exit 1" })),
      params: {},
      profile: "default",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("command failed");
  });
});
