export interface ScriptRunConfig {
  readonly scriptPath: string;
  readonly args?: readonly string[];
  readonly cwd?: string;
}

export interface ScriptResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface ScriptRunner {
  run(config: ScriptRunConfig): Promise<ScriptResult>;
}
