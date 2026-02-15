import { spawn } from "node:child_process";
import type { ScriptRunConfig, ScriptResult, ScriptRunner } from "./types.js";
import type { Logger } from "../logger.js";

export class PowerShellRunner implements ScriptRunner {
  constructor(private readonly logger: Logger) {}

  async run(config: ScriptRunConfig): Promise<ScriptResult> {
    this.logger.info({ script: config.scriptPath }, "Running PowerShell script");

    return new Promise((resolve, reject) => {
      const args = ["-File", config.scriptPath, ...(config.args ?? [])];
      const child = spawn("powershell.exe", args, {
        cwd: config.cwd ?? process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("exit", (code) => {
        resolve({ exitCode: code ?? -1, stdout, stderr });
      });

      child.on("error", (err) => {
        reject(new Error(`Failed to run script: ${err.message}`));
      });
    });
  }
}
