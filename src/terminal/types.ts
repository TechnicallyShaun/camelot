import type { AgentDefinition } from "../db/types.js";

export interface TerminalLaunchConfig {
  readonly agent: AgentDefinition;
  readonly prompt?: string;
  readonly cwd: string;
  readonly title?: string;
}

export interface TerminalLauncher {
  launchExternal(config: TerminalLaunchConfig): Promise<void>;
}
