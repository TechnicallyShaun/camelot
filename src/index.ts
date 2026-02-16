import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { SqliteDatabase, SqliteProjectRepository, SqliteTicketRepository, SqliteAgentRunRepository, SqliteAgentDefinitionRepository } from "./db/sqlite.js";
import { ProcessAgentSpawner } from "./agents/spawner.js";
import { createApp } from "./server/app.js";
import { TerminalManager } from "./terminal/manager.js";
import type { AgentEvent } from "./agents/types.js";

const config = loadConfig();
const logger = createLogger(config);

// Ensure data directory exists
const dataDir = resolve(process.cwd(), config.dataDir);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const dbPath = resolve(dataDir, "camelot.db");
const database = new SqliteDatabase(dbPath);
database.initialize();
logger.info({ dbPath }, "Database initialized");

// Create repositories
const projects = new SqliteProjectRepository(database.db);
const tickets = new SqliteTicketRepository(database.db);
const agentRuns = new SqliteAgentRunRepository(database.db);
const agentDefinitions = new SqliteAgentDefinitionRepository(database.db);

// Create agent spawner
const spawner = new ProcessAgentSpawner(logger);

// Create terminal manager
const terminalManager = new TerminalManager(logger, agentDefinitions);

// Create Express app
const app = createApp({ projects, tickets, agentRuns, agentDefinitions, logger });

// Create HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: "/ws" });
const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  logger.info("WebSocket client connected");

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleWebSocketMessage(ws, message);
    } catch (error) {
      logger.error({ error }, "Failed to parse WebSocket message");
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    terminalManager.killSessionsForWebSocket(ws);
    logger.info("WebSocket client disconnected");
  });
});

function handleWebSocketMessage(ws: WebSocket, message: any): void {
  switch (message.type) {
    case "terminal-create":
      try {
        const sessionId = terminalManager.createSession(
          ws, 
          message.sessionId, 
          message.agentId, 
          message.projectPath
        );
        logger.info({ sessionId }, "Terminal session created via WebSocket");
      } catch (error) {
        logger.error({ error }, "Failed to create terminal session");
        ws.send(JSON.stringify({
          type: "terminal-error",
          error: "Failed to create terminal session"
        }));
      }
      break;

    case "terminal-input":
      if (message.sessionId && typeof message.data === "string") {
        terminalManager.writeToSession(message.sessionId, message.data);
      }
      break;

    case "terminal-resize":
      if (message.sessionId && message.cols && message.rows) {
        terminalManager.resizeSession(message.sessionId, message.cols, message.rows);
      }
      break;

    case "terminal-kill":
      if (message.sessionId) {
        terminalManager.killSession(message.sessionId);
      }
      break;

    default:
      logger.debug({ type: message.type }, "Unknown WebSocket message type");
  }
}

function broadcast(type: string, data: unknown): void {
  const message = JSON.stringify({ type, data });
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

// Forward agent events to WebSocket clients
spawner.onEvent((event: AgentEvent) => {
  broadcast("agent-event", event);
});

// Cleanup inactive terminal sessions every hour
const cleanupInterval = setInterval(() => {
  terminalManager.cleanup();
}, 60 * 60 * 1000);

// Start server
server.listen(config.port, config.host, () => {
  logger.info({ port: config.port, host: config.host }, "🏰 Camelot is running");
  logger.info(`   UI: http://${config.host}:${config.port}`);
});

// Graceful shutdown
function gracefulShutdown() {
  logger.info("Shutting down...");
  clearInterval(cleanupInterval);
  
  // Kill all terminal sessions
  for (const session of terminalManager.getSessions()) {
    terminalManager.killSession(session.id);
  }
  
  wss.close();
  server.close();
  database.close();
  process.exit(0);
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
