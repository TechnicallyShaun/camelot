import { existsSync } from "node:fs";
import { spawn } from "node-pty";
import type { IPty } from "node-pty";
import type { WebSocket } from "ws";
import type { Logger } from "pino";
import type { AgentDefinitionRepository } from "../db/types.js";

interface TerminalSession {
  id: string;
  pty: IPty;
  ws: WebSocket;
  agentId: string;
  projectPath: string | null;
  created: Date;
  lastActivity: Date;
}

export class TerminalManager {
  private sessions = new Map<string, TerminalSession>();
  private logger: Logger;
  private agentDefinitions: AgentDefinitionRepository;

  constructor(logger: Logger, agentDefinitions: AgentDefinitionRepository) {
    this.logger = logger.child({ component: "terminal" });
    this.agentDefinitions = agentDefinitions;
  }

  createSession(ws: WebSocket, sessionId?: string, agentId?: string, projectPath?: string, prompt?: string): string {
    const id = sessionId || this.generateSessionId();
    
    // Get agent configuration, defaulting to primary agent
    const agent = agentId ? this.agentDefinitions.findById(agentId) : this.agentDefinitions.findPrimary();
    if (!agent) {
      throw new Error("No agent configuration found");
    }

    this.logger.info({ sessionId: id, agent: agent.name }, "Creating new terminal session");

    // Platform-specific shell detection
    const shell = process.platform === "win32" 
      ? "powershell.exe" 
      : process.env.SHELL || "/bin/bash";
      
    const args = process.platform === "win32" 
      ? ["-NoLogo", "-NoExit"] 
      : [];

    try {
      let cwd = process.cwd();
      if (projectPath) {
        if (existsSync(projectPath)) {
          cwd = projectPath;
        } else {
          this.logger.warn({ projectPath }, "Project path does not exist, falling back to default cwd");
        }
      }
      
      const pty = spawn(shell, args, {
        name: "xterm-256color",
        cols: 80,
        rows: 30,
        cwd,
        env: process.env,
      });

      const session: TerminalSession = {
        id,
        pty,
        ws,
        agentId: agent.id,
        projectPath: projectPath ?? null,
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
        sessionId: id,
        agent: agent.name
      }));

      // Auto-start the agent after a brief delay to ensure terminal is ready
      setTimeout(() => {
        const agentCommand = this.buildAgentCommand(agent, prompt);
        this.logger.info({ sessionId: id, command: agentCommand }, "Auto-starting agent");
        pty.write(`${agentCommand}\r`);
      }, 500);

      this.logger.info({ sessionId: id, shell, agent: agent.name }, "Terminal session created");
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

  getSessions(): Array<{ id: string; agentId: string; projectPath: string | null; created: Date; lastActivity: Date }> {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      agentId: session.agentId,
      projectPath: session.projectPath,
      created: session.created,
      lastActivity: session.lastActivity
    }));
  }

  private generateSessionId(): string {
    return `term-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private buildAgentCommand(agent: any, prompt?: string): string {
    const args = [...agent.defaultArgs];
    
    // Strip -i from default args — we add it back only when there's a prompt
    const filteredArgs = agent.command === 'copilot'
      ? args.filter((a: string) => a !== '-i')
      : args;

    if (prompt) {
      const escaped = this.escapeForShell(prompt);
      // Copilot CLI: use -i flag for initial prompt
      if (agent.command === 'copilot') {
        return `${agent.command} ${filteredArgs.join(' ')} -i "${escaped}"`;
      }
      // Claude Code: positional argument for initial prompt
      if (agent.command === 'claude') {
        return `${agent.command} "${escaped}" ${filteredArgs.join(' ')}`;
      }
      // Generic: try positional arg
      return `${agent.command} ${filteredArgs.join(' ')} "${escaped}"`;
    }
    
    return `${agent.command} ${filteredArgs.join(' ')}`;
  }

  private escapeForShell(input: string): string {
    if (process.platform === 'win32') {
      // PowerShell: backtick is the escape character
      return input
        .replace(/`/g, '``')
        .replace(/"/g, '`"')
        .replace(/\$/g, '`$')
        .replace(/\n/g, '`n')
        .replace(/\r/g, '`r');
    }
    // Unix shells: backslash escaping
    return input
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  getSessionInfo(sessionId: string): { agent: any; projectPath: string | null } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const agent = this.agentDefinitions.findById(session.agentId);
    if (!agent) return null;

    return {
      agent,
      projectPath: session.projectPath
    };
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