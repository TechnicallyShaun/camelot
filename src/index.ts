import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { SqliteDatabase, SqliteProjectRepository, SqliteTicketRepository, SqliteAgentRunRepository } from "./db/sqlite.js";
import { ProcessAgentSpawner } from "./agents/spawner.js";
import { createApp } from "./server/app.js";
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

// Create agent spawner
const spawner = new ProcessAgentSpawner(logger);

// Create Express app
const app = createApp({ projects, tickets, agentRuns, logger });

// Create HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: "/ws" });
const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  logger.info("WebSocket client connected");

  ws.on("close", () => {
    clients.delete(ws);
    logger.info("WebSocket client disconnected");
  });
});

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

// Start server
server.listen(config.port, config.host, () => {
  logger.info({ port: config.port, host: config.host }, "🏰 Camelot is running");
  logger.info(`   UI: http://${config.host}:${config.port}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down...");
  wss.close();
  server.close();
  database.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Shutting down...");
  wss.close();
  server.close();
  database.close();
  process.exit(0);
});
