import { execSync } from "node:child_process";
import type { Service, ServiceRepository, Tool } from "../db/types.js";
import type { ExecutionResult, ToolExecutionContext } from "./types.js";
import { interpolateTemplate, parseStructuredContent } from "./content-parser.js";

interface ShellToolDefinition {
  readonly type: "shell";
  readonly command: string;
  readonly cwd?: string;
  readonly serviceId?: string;
}

interface HttpToolDefinition {
  readonly type: "http";
  readonly method?: string;
  readonly url?: string;
  readonly path?: string;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  readonly serviceId?: string;
}

type ToolDefinition = ShellToolDefinition | HttpToolDefinition;

export interface ToolExecutorDeps {
  readonly services: ServiceRepository;
  readonly execCommand?: (command: string, cwd?: string) => string;
  readonly httpRequest?: (url: string, init: RequestInit) => Promise<unknown>;
}

export class ToolExecutor {
  private readonly execCommand: (command: string, cwd?: string) => string;
  private readonly httpRequest: (url: string, init: RequestInit) => Promise<unknown>;

  constructor(private readonly deps: ToolExecutorDeps) {
    this.execCommand = deps.execCommand ?? ((command: string, cwd?: string) => execSync(command, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      cwd,
    }));

    this.httpRequest = deps.httpRequest ?? (async (url: string, init: RequestInit) => {
      const response = await fetch(url, init);
      const contentType = response.headers.get("content-type") ?? "";
      const output = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(output)}`);
      }

      return output;
    });
  }

  async execute(context: ToolExecutionContext): Promise<ExecutionResult> {
    const definition = this.parseToolDefinition(context.tool);

    try {
      if (definition.type === "shell") {
        return this.executeShellTool(definition, context.params);
      }

      return this.executeHttpTool(definition, context.params);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown tool execution error";
      return {
        success: false,
        output: null,
        error: message,
        metadata: {
          toolId: context.tool.id,
          toolName: context.tool.name,
          profile: context.profile,
        },
      };
    }
  }

  private parseToolDefinition(tool: Tool): ToolDefinition {
    const parsed = parseStructuredContent(tool.content);
    if (!parsed || typeof parsed !== "object") {
      throw new Error(`Invalid tool definition in ${tool.name}`);
    }

    const type = (parsed as Record<string, unknown>).type;
    if (type !== "shell" && type !== "http") {
      throw new Error(`Unsupported tool type for ${tool.name}`);
    }

    return parsed as ToolDefinition;
  }

  private resolveService(serviceId?: string): Service | undefined {
    if (!serviceId) {
      return undefined;
    }

    return this.deps.services.findById(serviceId);
  }

  private executeShellTool(definition: ShellToolDefinition, params: Record<string, unknown>): ExecutionResult {
    const command = interpolateTemplate(definition.command, params);
    const cwd = definition.cwd ? interpolateTemplate(definition.cwd, params) : undefined;

    const output = this.execCommand(command, cwd);
    return {
      success: true,
      output,
      metadata: {
        command,
        cwd,
      },
    };
  }

  private async executeHttpTool(
    definition: HttpToolDefinition,
    params: Record<string, unknown>
  ): Promise<ExecutionResult> {
    const service = this.resolveService(definition.serviceId);
    const serviceBaseUrl = service?.baseUrl ?? "";

    const resolvedUrl = definition.url
      ? interpolateTemplate(definition.url, params)
      : `${serviceBaseUrl}${interpolateTemplate(definition.path ?? "", params)}`;

    if (!resolvedUrl) {
      throw new Error("HTTP tool requires a url or path/service baseUrl");
    }

    const headers: Record<string, string> = {
      ...(definition.headers ?? {}),
    };

    const method = definition.method ?? "GET";

    const init: RequestInit = {
      method,
      headers,
    };

    if (definition.body !== undefined) {
      init.body = typeof definition.body === "string"
        ? interpolateTemplate(definition.body, params)
        : JSON.stringify(definition.body);
      if (!headers["content-type"]) {
        headers["content-type"] = "application/json";
      }
    }

    const output = await this.httpRequest(resolvedUrl, init);

    return {
      success: true,
      output,
      metadata: {
        method,
        url: resolvedUrl,
        serviceId: service?.id,
      },
    };
  }
}
