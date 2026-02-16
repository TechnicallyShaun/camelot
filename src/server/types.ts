import type { Server } from "http";

export interface ServerConfig {
  readonly port: number;
  readonly host: string;
}

export interface CamelotServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly httpServer: Server | null;
}
