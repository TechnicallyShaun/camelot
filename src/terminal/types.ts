export interface TerminalLaunchConfig {
  readonly agent: string;
  readonly prompt?: string;
  readonly cwd: string;
  readonly title?: string;
}

export interface TerminalLauncher {
  launchExternal(config: TerminalLaunchConfig): Promise<void>;
}
