"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const ws_1 = require("ws");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const config_js_1 = require("./config.js");
const logger_js_1 = require("./logger.js");
const sqlite_js_1 = require("./db/sqlite.js");
const skill_publisher_js_1 = require("./db/skill-publisher.js");
const sdp_plan_reader_js_1 = require("./db/sdp-plan-reader.js");
const daily_summary_generator_js_1 = require("./db/daily-summary-generator.js");
const daily_summary_exporter_js_1 = require("./db/daily-summary-exporter.js");
const spawner_js_1 = require("./agents/spawner.js");
const app_js_1 = require("./server/app.js");
const manager_js_1 = require("./terminal/manager.js");
const config = (0, config_js_1.loadConfig)();
const logger = (0, logger_js_1.createLogger)(config);
// Ensure data directory exists
const dataDir = (0, node_path_1.resolve)(process.cwd(), config.dataDir);
if (!(0, node_fs_1.existsSync)(dataDir)) {
    (0, node_fs_1.mkdirSync)(dataDir, { recursive: true });
}
// Initialize database
const dbPath = (0, node_path_1.resolve)(dataDir, "camelot.db");
const database = new sqlite_js_1.SqliteDatabase(dbPath);
database.initialize();
logger.info({ dbPath }, "Database initialized");
// Create repositories
const projects = new sqlite_js_1.SqliteProjectRepository(database.db);
const tickets = new sqlite_js_1.SqliteTicketRepository(database.db);
const agentRuns = new sqlite_js_1.SqliteAgentRunRepository(database.db);
const agentDefinitions = new sqlite_js_1.SqliteAgentDefinitionRepository(database.db);
const skills = new sqlite_js_1.SqliteSkillRepository(database.db);
const tools = new sqlite_js_1.SqliteToolRepository(database.db);
const services = new sqlite_js_1.SqliteServiceRepository(database.db);
const ticketActivity = new sqlite_js_1.SqliteTicketActivityRepository(database.db);
// Create skill publisher
const skillPublisher = new skill_publisher_js_1.FileSystemSkillPublisher(skills, logger);
// Create SDP plan reader
const sdpPlanReader = new sdp_plan_reader_js_1.FileSystemSdpPlanReader(tickets, logger);
// Create daily summary generator
const dailySummaryGenerator = new daily_summary_generator_js_1.DatabaseDailySummaryGenerator(ticketActivity, tickets, agentRuns, logger);
// Create daily summary exporter
const dailySummaryExporter = new daily_summary_exporter_js_1.FileSystemDailySummaryExporter(dailySummaryGenerator, logger);
// Create agent spawner
const spawner = new spawner_js_1.ProcessAgentSpawner(logger);
// Create terminal manager
const terminalManager = new manager_js_1.TerminalManager(logger, agentDefinitions);
// Create Express app
const app = (0, app_js_1.createApp)({
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
    logger
});
// Create HTTP server
const server = (0, node_http_1.createServer)(app);
// WebSocket server
const wss = new ws_1.WebSocketServer({ server, path: "/ws" });
const clients = new Set();
wss.on("connection", (ws) => {
    clients.add(ws);
    logger.info("WebSocket client connected");
    ws.on("message", (data) => {
        try {
            const message = JSON.parse(data.toString());
            handleWebSocketMessage(ws, message);
        }
        catch (error) {
            logger.error({ error }, "Failed to parse WebSocket message");
        }
    });
    ws.on("close", () => {
        clients.delete(ws);
        terminalManager.killSessionsForWebSocket(ws);
        logger.info("WebSocket client disconnected");
    });
});
function handleWebSocketMessage(ws, message) {
    switch (message.type) {
        case "terminal-create":
            try {
                const sessionId = terminalManager.createSession(ws, message.sessionId, message.agentId, message.projectPath);
                logger.info({ sessionId }, "Terminal session created via WebSocket");
            }
            catch (error) {
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
function broadcast(type, data) {
    const message = JSON.stringify({ type, data });
    for (const client of clients) {
        if (client.readyState === 1) {
            client.send(message);
        }
    }
}
// Forward agent events to WebSocket clients
spawner.onEvent((event) => {
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
//# sourceMappingURL=index.js.map