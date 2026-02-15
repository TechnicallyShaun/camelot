export interface AgentConfig {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env?: Record<string, string>;
}

export interface AgentDefinition {
  readonly id: string;
  readonly name: string;
  readonly command: string;
  readonly defaultArgs: readonly string[];
  readonly model: string | null;
  readonly isPrimary: boolean;
}

export interface AgentProcess {
  readonly id: string;
  readonly definition: AgentDefinition;
  readonly pid: number | null;
  readonly status: "running" | "completed" | "failed";
  kill(): void;
}

export interface AgentSpawner {
  spawn(config: AgentConfig): AgentProcess;
  kill(runId: string): void;
  list(): AgentProcess[];
  get(runId: string): AgentProcess | undefined;
}

export interface AgentEvent {
  readonly runId: string;
  readonly type: "stdout" | "stderr" | "exit" | "error";
  readonly data: string;
  readonly timestamp: number;
}

export type AgentEventHandler = (event: AgentEvent) => void;
