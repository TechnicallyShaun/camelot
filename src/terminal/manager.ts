import { spawn } from "node-pty";
import type { IPty } from "node-pty";
import type { WebSocket } from "ws";
import type { Logger } from "pino";

interface TerminalSession {
  id: string;
  pty: IPty;
  ws: WebSocket;
  created: Date;
  lastActivity: Date;
}

export class TerminalManager {
  private sessions = new Map<string, TerminalSession>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: "terminal" });
  }

  createSession(ws: WebSocket, sessionId?: string): string {
    const id = sessionId || this.generateSessionId();
    
    this.logger.info({ sessionId: id }, "Creating new terminal session");

    // Platform-specific shell detection
    const shell = process.platform === "win32" 
      ? "powershell.exe" 
      : process.env.SHELL || "/bin/bash";
      
    const args = process.platform === "win32" 
      ? ["-NoLogo", "-NoExit"] 
      : [];

    try {
      const pty = spawn(shell, args, {
        name: "xterm-color",
        cols: 80,
        rows: 30,
        cwd: process.cwd(),
        env: process.env,
      });

      const session: TerminalSession = {
        id,
        pty,
        ws,
        created: new Date(),
        lastActivity: new Date()
      };

      // Handle PTY data (output)
      pty.onData((data) => {
        session.lastActivity = new Date();
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: "terminal-data",
            sessionId: id,
            data
          }));
        }
      });

      // Handle PTY exit
      pty.onExit((event) => {
        this.logger.info({ sessionId: id, exitCode: event.exitCode }, "Terminal session ended");
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: "terminal-exit",
            sessionId: id,
            exitCode: event.exitCode
          }));
        }
        this.sessions.delete(id);
      });

      this.sessions.set(id, session);

      // Send session created event
      ws.send(JSON.stringify({
        type: "terminal-created",
        sessionId: id
      }));

      this.logger.info({ sessionId: id, shell }, "Terminal session created");
      return id;

    } catch (error) {
      this.logger.error({ error, sessionId: id }, "Failed to create terminal session");
      throw new Error(`Failed to create terminal session: ${error}`);
    }
  }

  writeToSession(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn({ sessionId }, "Attempted to write to non-existent session");
      return;
    }

    session.lastActivity = new Date();
    session.pty.write(data);
  }

  resizeSession(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn({ sessionId }, "Attempted to resize non-existent session");
      return;
    }

    session.pty.resize(cols, rows);
    this.logger.debug({ sessionId, cols, rows }, "Terminal resized");
  }

  killSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.logger.info({ sessionId }, "Killing terminal session");
    session.pty.kill();
    this.sessions.delete(sessionId);
  }

  killSessionsForWebSocket(ws: WebSocket): void {
    for (const [sessionId, session] of this.sessions) {
      if (session.ws === ws) {
        this.logger.info({ sessionId }, "Cleaning up session for disconnected WebSocket");
        session.pty.kill();
        this.sessions.delete(sessionId);
      }
    }
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getSessions(): Array<{ id: string; created: Date; lastActivity: Date }> {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      created: session.created,
      lastActivity: session.lastActivity
    }));
  }

  private generateSessionId(): string {
    return `term-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // Clean up old inactive sessions
  cleanup(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [sessionId, session] of this.sessions) {
      const age = now.getTime() - session.lastActivity.getTime();
      if (age > maxAge) {
        this.logger.info({ sessionId, age }, "Cleaning up inactive session");
        this.killSession(sessionId);
      }
    }
  }
}