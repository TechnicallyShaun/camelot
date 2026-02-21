import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { SqliteDatabase, SqliteProjectRepository, SqliteTicketRepository, SqliteAgentRunRepository, SqliteAgentDefinitionRepository, SqliteSkillRepository, SqliteToolRepository, SqliteServiceRepository, SqliteWorkloadAdapterRepository, SqliteTicketActivityRepository } from "./db/sqlite.js";
import { FileSystemSkillPublisher } from "./db/skill-publisher.js";
import { FileSystemSdpPlanReader } from "./db/sdp-plan-reader.js";
import { DatabaseDailySummaryGenerator } from "./db/daily-summary-generator.js";
import { FileSystemDailySummaryExporter } from "./db/daily-summary-exporter.js";
import { ToolExecutor } from "./execution/tool-executor.js";
import { SkillRunner } from "./execution/skill-runner.js";
import { StandupGenerator } from "./standup/standup-generator.js";
import { TicketReviewer } from "./review/ticket-reviewer.js";
import { WorkloadAdapterRegistry } from "./workload/adapter-registry.js";
import { GitHubWorkloadAdapter } from "./workload/github-adapter.js";
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
const skills = new SqliteSkillRepository(database.db);
const tools = new SqliteToolRepository(database.db);
const services = new SqliteServiceRepository(database.db);
const workloadAdapterRepository = new SqliteWorkloadAdapterRepository(database.db);
const ticketActivity = new SqliteTicketActivityRepository(database.db);

// Create execution runtime
const toolExecutor = new ToolExecutor({ services });
const skillRunner = new SkillRunner({ skills, tools, toolExecutor });

// Create workload adapter registry from persisted adapter definitions
const workloadAdapters = new WorkloadAdapterRegistry();
for (const adapter of workloadAdapterRepository.findAll()) {
  if (adapter.type !== "github") {
    logger.warn({ adapterId: adapter.id, type: adapter.type }, "Skipping unsupported workload adapter type");
    continue;
  }

  try {
    const config = JSON.parse(adapter.config) as { owner?: string; repo?: string; projectNumber?: number };
    if (!config.owner || !config.repo) {
      logger.warn({ adapterId: adapter.id }, "Skipping workload adapter with invalid GitHub config");
      continue;
    }

    workloadAdapters.register(
      adapter.name,
      new GitHubWorkloadAdapter(config.owner, config.repo, config.projectNumber),
      adapter.isActive
    );
  } catch (error) {
    logger.warn({ error, adapterId: adapter.id }, "Skipping workload adapter with malformed config");
  }
}

// Create skill publisher
const skillPublisher = new FileSystemSkillPublisher(skills, logger);

// Create SDP plan reader
const sdpPlanReader = new FileSystemSdpPlanReader(tickets, logger);

// Create daily summary generator
const dailySummaryGenerator = new DatabaseDailySummaryGenerator(ticketActivity, tickets, agentRuns, logger);

// Create daily summary exporter
const dailySummaryExporter = new FileSystemDailySummaryExporter(dailySummaryGenerator, logger);

// Create agent spawner
const spawner = new ProcessAgentSpawner(logger);

// Create terminal manager
const terminalManager = new TerminalManager(logger, agentDefinitions);

// Create Express app
const app = createApp({ 
  projects, 
  tickets, 
  agentRuns, 
  agentDefinitions, 
  skills, 
  tools,
  services,
  skillPublisher, 
  skillsPublishPath: config.skillsPublishPath,
  sdpPlanReader,
  sdpPlansPath: config.sdpPlansPath,
  ticketActivity,
  dailySummaryGenerator,
  dailySummaryExporter,
  dailySummaryExportPath: config.dailySummaryExportPath,
  skillRunner,
  standupGenerator: new StandupGenerator(ticketActivity, tickets, logger),
  ticketReviewer: new TicketReviewer({ logger }),
  workloadAdapters,
  workloadAdapterRepository,
  logger 
});

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
          message.projectPath,
          message.prompt
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
