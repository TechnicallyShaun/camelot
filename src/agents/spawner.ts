import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { AgentConfig, AgentProcess, AgentSpawner, AgentEvent, AgentEventHandler, AgentDefinition } from "./types.js";
import type { Logger } from "../logger.js";

class ManagedAgentProcess implements AgentProcess {
  readonly id: string;
  readonly definition: AgentDefinition;
  private process: ChildProcess | null = null;
  private _status: "running" | "completed" | "failed" = "running";

  constructor(
    id: string,
    definition: AgentDefinition,
    process: ChildProcess,
  ) {
    this.id = id;
    this.definition = definition;
    this.process = process;
  }

  get pid(): number | null {
    return this.process?.pid ?? null;
  }

  get status(): "running" | "completed" | "failed" {
    return this._status;
  }

  set statusValue(value: "running" | "completed" | "failed") {
    this._status = value;
  }

  kill(): void {
    if (this.process && !this.process.killed) {
      this.process.kill("SIGTERM");
      this._status = "failed";
    }
  }
}

export class ProcessAgentSpawner extends EventEmitter implements AgentSpawner {
  private readonly processes = new Map<string, ManagedAgentProcess>();

  constructor(private readonly logger: Logger) {
    super();
  }

  spawn(config: AgentConfig): AgentProcess {
    const id = randomUUID();
    const definition: AgentDefinition = {
      id: config.name,
      name: config.name,
      command: config.command,
      defaultArgs: config.args,
      model: null,
      isPrimary: false,
    };

    this.logger.info({ id, command: config.command, args: config.args, cwd: config.cwd }, "Spawning agent");

    const child = spawn(config.command, [...config.args], {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    const managed = new ManagedAgentProcess(id, definition, child);
    this.processes.set(id, managed);

    child.stdout?.on("data", (data: Buffer) => {
      const event: AgentEvent = {
        runId: id,
        type: "stdout",
        data: data.toString(),
        timestamp: Date.now(),
      };
      this.emit("event", event);
    });

    child.stderr?.on("data", (data: Buffer) => {
      const event: AgentEvent = {
        runId: id,
        type: "stderr",
        data: data.toString(),
        timestamp: Date.now(),
      };
      this.emit("event", event);
    });

    child.on("exit", (code) => {
      managed.statusValue = code === 0 ? "completed" : "failed";
      const event: AgentEvent = {
        runId: id,
        type: "exit",
        data: String(code ?? -1),
        timestamp: Date.now(),
      };
      this.emit("event", event);
      this.logger.info({ id, exitCode: code }, "Agent exited");
    });

    child.on("error", (err) => {
      managed.statusValue = "failed";
      const event: AgentEvent = {
        runId: id,
        type: "error",
        data: err.message,
        timestamp: Date.now(),
      };
      this.emit("event", event);
      this.logger.error({ id, error: err.message }, "Agent error");
    });

    return managed;
  }

  kill(runId: string): void {
    const proc = this.processes.get(runId);
    if (proc) {
      proc.kill();
    }
  }

  list(): AgentProcess[] {
    return Array.from(this.processes.values());
  }

  get(runId: string): AgentProcess | undefined {
    return this.processes.get(runId);
  }

  onEvent(handler: AgentEventHandler): void {
    this.on("event", handler);
  }
}
