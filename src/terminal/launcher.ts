import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { TerminalLaunchConfig, TerminalLauncher } from "./types.js";
import type { Logger } from "../logger.js";

const execAsync = promisify(exec);

export class WindowsTerminalLauncher implements TerminalLauncher {
  constructor(private readonly logger: Logger) {}

  async launchExternal(config: TerminalLaunchConfig): Promise<void> {
    const title = config.title ?? `Camelot - ${config.agent.name}`;
    const agentCommand = this.buildAgentCommand(config);

    const wtCommand = `wt.exe new-tab --title "${title}" --startingDirectory "${config.cwd}" powershell -NoExit -Command "${agentCommand}"`;

    this.logger.info({ agent: config.agent.id, cwd: config.cwd }, "Launching external terminal");

    try {
      await execAsync(wtCommand);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({ error: message }, "Failed to launch terminal");
      throw new Error(`Failed to launch terminal: ${message}`);
    }
  }

  private buildAgentCommand(config: TerminalLaunchConfig): string {
    const agent = config.agent;
    const parts = [agent.command, ...agent.defaultArgs];
    if (!config.prompt) {
      return parts.join(" ").trim();
    }

    const escapedPrompt = this.escapeSingleQuoted(config.prompt);
    if (agent.promptMethod === "flag" && agent.promptFlag) {
      parts.push(agent.promptFlag, `'${escapedPrompt}'`);
    } else if (agent.promptMethod === "positional") {
      parts.push(`'${escapedPrompt}'`);
    }
    return parts.join(" ").trim();
  }

  private escapeSingleQuoted(value: string): string {
    return value.replace(/'/g, "''");
  }
}
