import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { TerminalLaunchConfig, TerminalLauncher } from "./types.js";
import type { Logger } from "../logger.js";

const execAsync = promisify(exec);

export class WindowsTerminalLauncher implements TerminalLauncher {
  constructor(private readonly logger: Logger) {}

  async launchExternal(config: TerminalLaunchConfig): Promise<void> {
    const title = config.title ?? `Camelot - ${config.agent}`;
    const agentCommand = this.buildAgentCommand(config);

    const wtCommand = `wt.exe new-tab --title "${title}" --startingDirectory "${config.cwd}" powershell -NoExit -Command "${agentCommand}"`;

    this.logger.info({ agent: config.agent, cwd: config.cwd }, "Launching external terminal");

    try {
      await execAsync(wtCommand);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({ error: message }, "Failed to launch terminal");
      throw new Error(`Failed to launch terminal: ${message}`);
    }
  }

  private buildAgentCommand(config: TerminalLaunchConfig): string {
    if (config.agent === "copilot") {
      return config.prompt
        ? `copilot -i '${config.prompt}' --allow-all-tools --allow-all-paths`
        : `copilot -i --allow-all-tools --allow-all-paths`;
    }
    if (config.agent === "claude") {
      return config.prompt
        ? `claude '${config.prompt}' --dangerously-skip-permissions`
        : `claude --dangerously-skip-permissions`;
    }
    return config.agent;
  }
}
