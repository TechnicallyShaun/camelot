import { Router, type Request, type Response } from "express";
import type { ProjectRepository, TicketRepository, AgentRunRepository, AgentDefinitionRepository, SkillRepository, ToolRepository, ServiceRepository, SkillPublisher, SdpPlanReader, TicketActivityRepository, DailySummaryGenerator, DailySummaryExporter, TicketStage, WorkloadAdapterRepository } from "../db/types.js";
import type { Logger } from "../logger.js";
import type { SkillRunner } from "../execution/skill-runner.js";
import type { WorkloadAdapterRegistry } from "../workload/adapter-registry.js";
import type { WorkloadTicket } from "../workload/types.js";
import type { StandupGenerator } from "../standup/standup-generator.js";
import type { AcceptanceTestRunner } from "../acceptance/test-runner.js";
import type { TicketReviewer } from "../review/ticket-reviewer.js";

export interface RoutesDeps {
  readonly projects: ProjectRepository;
  readonly tickets: TicketRepository;
  readonly agentRuns: AgentRunRepository;
  readonly agentDefinitions: AgentDefinitionRepository;
  readonly skills: SkillRepository;
  readonly tools: ToolRepository;
  readonly services: ServiceRepository;
  readonly skillPublisher: SkillPublisher;
  readonly skillsPublishPath: string;
  readonly sdpPlanReader: SdpPlanReader;
  readonly sdpPlansPath: string | null;
  readonly ticketActivity: TicketActivityRepository;
  readonly dailySummaryGenerator: DailySummaryGenerator;
  readonly dailySummaryExporter: DailySummaryExporter;
  readonly dailySummaryExportPath: string;
  readonly skillRunner?: SkillRunner;
  readonly workloadAdapters?: WorkloadAdapterRegistry;
  readonly workloadAdapterRepository?: WorkloadAdapterRepository;
  readonly standupGenerator?: StandupGenerator;
  readonly ticketReviewer?: TicketReviewer;
  readonly acceptanceTestRunner?: AcceptanceTestRunner;
  readonly logger: Logger;
}

export function createApiRouter(deps: RoutesDeps): Router {
  const router = Router();

  // Health check endpoint
  router.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // Projects
  router.get("/projects", (_req: Request, res: Response) => {
    const projects = deps.projects.findAll();
    res.json(projects);
  });

  router.post("/projects", (req: Request, res: Response) => {
    const { name, location } = req.body as { name?: string; location?: string };
    if (!name || !location) {
      res.status(400).json({ error: "name and location are required" });
      return;
    }
    const project = deps.projects.create(name, location);
    res.status(201).json(project);
  });

  router.delete("/projects/:id", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const removed = deps.projects.remove(id);
    if (!removed) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(204).end();
  });

  // Tickets
  router.get("/tickets", (_req: Request, res: Response) => {
    const tickets = deps.tickets.findAll();
    res.json(tickets);
  });

  router.post("/tickets", (req: Request, res: Response) => {
    const { title, projectId } = req.body as { title?: string; projectId?: number };
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    
    const ticket = deps.tickets.create(title, projectId);
    
    // Log the creation activity
    try {
      deps.ticketActivity.create({
        ticketId: ticket.id,
        sessionId: req.headers['x-session-id'] as string || 'web',
        action: 'created',
        metadata: JSON.stringify({ projectId }),
      });
    } catch (error) {
      deps.logger.warn({ error, ticketId: ticket.id }, "Failed to log ticket creation activity");
    }
    
    res.status(201).json(ticket);
  });

  // Generic ticket update (title, stage, project_id)
  router.patch("/tickets/:id", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { title, stage, projectId } = req.body as { title?: string; stage?: TicketStage; projectId?: number | null };

    const ticket = deps.tickets.findById(id);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const updates: { title?: string; stage?: TicketStage; projectId?: number | null } = {};
    if (title !== undefined) updates.title = title;
    if (stage !== undefined) updates.stage = stage;
    if (projectId !== undefined) updates.projectId = projectId;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No updates provided" });
      return;
    }

    const updated = deps.tickets.update(id, updates);
    if (!updated) {
      res.status(500).json({ error: "Failed to update ticket" });
      return;
    }

    // Log activity
    try {
      deps.ticketActivity.create({
        ticketId: id,
        sessionId: req.headers['x-session-id'] as string || 'web',
        action: 'updated',
        metadata: JSON.stringify(updates),
      });
    } catch (error) {
      deps.logger.warn({ error, ticketId: id }, "Failed to log ticket update activity");
    }

    const result = deps.tickets.findById(id);
    res.json(result);
  });

  router.patch("/tickets/:id/stage", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { stage } = req.body as { stage?: TicketStage };
    if (!stage) {
      res.status(400).json({ error: "stage is required" });
      return;
    }
    
    const updated = deps.tickets.updateStage(id, stage);
    if (!updated) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    
    // Log the stage change activity
    try {
      deps.ticketActivity.create({
        ticketId: id,
        sessionId: req.headers['x-session-id'] as string || 'web',
        action: 'stage_changed',
        metadata: JSON.stringify({ newStage: stage }),
      });
    } catch (error) {
      deps.logger.warn({ error, ticketId: id }, "Failed to log ticket stage change activity");
    }
    
    res.json({ id, stage });
  });

  router.delete("/tickets/:id", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    
    // Log the deletion activity
    try {
      deps.ticketActivity.create({
        ticketId: id,
        sessionId: req.headers['x-session-id'] as string || 'unknown',
        action: 'deleted',
      });
    } catch (error) {
      // Don't fail the deletion if activity logging fails
      deps.logger.warn({ error, ticketId: id }, "Failed to log ticket deletion activity");
    }
    
    const removed = deps.tickets.remove(id);
    if (!removed) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.status(204).end();
  });

  // Ticket Activity
  router.get("/ticket-activity", (req: Request, res: Response) => {
    const { ticketId, sessionId, limit, startDate, endDate } = req.query;
    
    try {
      let activities;
      
      if (ticketId) {
        activities = deps.ticketActivity.findByTicketId(Number(ticketId));
      } else if (sessionId) {
        activities = deps.ticketActivity.findBySessionId(String(sessionId));
      } else if (startDate && endDate) {
        activities = deps.ticketActivity.findByDateRange(String(startDate), String(endDate));
      } else {
        const limitNum = limit ? Number(limit) : undefined;
        activities = deps.ticketActivity.findAll(limitNum);
      }
      
      res.json(activities);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      deps.logger.error({ error }, "Failed to query ticket activity");
      res.status(500).json({ error: message });
    }
  });

  router.post("/ticket-activity", (req: Request, res: Response) => {
    const { ticketId, sessionId, action, metadata } = req.body as {
      ticketId?: number;
      sessionId?: string;
      action?: string;
      metadata?: string;
    };

    if (!ticketId || !sessionId || !action) {
      res.status(400).json({ error: "ticketId, sessionId, and action are required" });
      return;
    }

    try {
      const activity = deps.ticketActivity.create({
        ticketId,
        sessionId,
        action: action as any, // Type assertion since we validate above
        metadata,
      });
      res.status(201).json(activity);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      deps.logger.error({ error, ticketId, sessionId, action }, "Failed to create ticket activity");
      res.status(500).json({ error: message });
    }
  });

  // Daily Summary
  router.get("/daily-summary", async (req: Request, res: Response) => {
    const { date } = req.query;
    
    if (!date || typeof date !== 'string') {
      res.status(400).json({ error: "date parameter is required (format: YYYY-MM-DD)" });
      return;
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      return;
    }

    try {
      const summary = await deps.dailySummaryGenerator.generateSummary(date);
      res.json(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      deps.logger.error({ error, date }, "Failed to generate daily summary");
      res.status(500).json({ error: message });
    }
  });

  router.post("/daily-summary/export", async (req: Request, res: Response) => {
    const { date, outputDir } = req.body as { date?: string; outputDir?: string };
    
    if (!date || typeof date !== 'string') {
      res.status(400).json({ error: "date is required (format: YYYY-MM-DD)" });
      return;
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      return;
    }

    const exportPath = outputDir || deps.dailySummaryExportPath;

    try {
      const filePath = await deps.dailySummaryExporter.exportToFile(date, exportPath);
      res.json({
        success: true,
        filePath,
        message: `Daily summary for ${date} exported to ${filePath}`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      deps.logger.error({ error, date, exportPath }, "Failed to export daily summary");
      res.status(500).json({ error: message });
    }
  });

  // SDP Plans
  router.get("/sdp-plans", async (_req: Request, res: Response) => {
    if (!deps.sdpPlansPath) {
      res.status(400).json({ error: "SDP plans path not configured" });
      return;
    }

    try {
      const plans = await deps.sdpPlanReader.scanDirectory(deps.sdpPlansPath);
      res.json(plans);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      deps.logger.error({ error, sdpPlansPath: deps.sdpPlansPath }, "Failed to scan SDP plans");
      res.status(500).json({ error: message });
    }
  });

  router.post("/sdp-plans/sync", async (req: Request, res: Response) => {
    if (!deps.sdpPlansPath) {
      res.status(400).json({ error: "SDP plans path not configured" });
      return;
    }

    const { projectId } = req.body as { projectId?: number };

    try {
      const plans = await deps.sdpPlanReader.scanDirectory(deps.sdpPlansPath);
      const syncResult = await deps.sdpPlanReader.syncPlansToTickets(plans, projectId);
      
      res.json({
        success: true,
        plansFound: plans.length,
        ...syncResult,
        message: `Synced ${plans.length} plans: ${syncResult.created} created, ${syncResult.updated} updated`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      deps.logger.error({ error, sdpPlansPath: deps.sdpPlansPath }, "Failed to sync SDP plans");
      res.status(500).json({ error: message });
    }
  });

  // Agent Runs
  router.get("/agent-runs", (req: Request, res: Response) => {
    const limit = Number(req.query.limit) || 50;
    const runs = deps.agentRuns.findAll(limit);
    res.json(runs);
  });

  // Agent Configuration
  router.get("/agents", (_req: Request, res: Response) => {
    const agents = deps.agentDefinitions.findAll();
    res.json(agents);
  });

  router.get("/agents/primary", (_req: Request, res: Response) => {
    const primary = deps.agentDefinitions.findPrimary();
    if (!primary) {
      res.status(404).json({ error: "No primary agent configured" });
      return;
    }
    res.json(primary);
  });

  router.post("/agents", (req: Request, res: Response) => {
    const { id, name, command, defaultArgs, model } = req.body as {
      id?: string;
      name?: string;
      command?: string;
      defaultArgs?: string[];
      model?: string | null;
    };

    if (!id || !name || !command || !Array.isArray(defaultArgs)) {
      res.status(400).json({ error: "id, name, command, and defaultArgs are required" });
      return;
    }

    try {
      const agent = deps.agentDefinitions.create({ id, name, command, defaultArgs, model: model ?? null });
      res.status(201).json(agent);
    } catch (error) {
      res.status(400).json({ error: "Agent ID already exists" });
    }
  });

  router.put("/agents/:id", (req: Request, res: Response) => {
    const id = req.params.id;
    const updates = req.body as Partial<{
      name: string;
      command: string;
      defaultArgs: string[];
      model: string | null;
    }>;

    const success = deps.agentDefinitions.update(id, updates);
    if (!success) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    const updated = deps.agentDefinitions.findById(id);
    res.json(updated);
  });

  router.post("/agents/:id/set-primary", (req: Request, res: Response) => {
    const id = req.params.id;
    const success = deps.agentDefinitions.setPrimary(id);
    if (!success) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json({ id, isPrimary: true });
  });

  router.delete("/agents/:id", (req: Request, res: Response) => {
    const id = req.params.id;
    const agent = deps.agentDefinitions.findById(id);
    
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    if (agent.isPrimary) {
      res.status(400).json({ error: "Cannot delete primary agent" });
      return;
    }

    const removed = deps.agentDefinitions.remove(id);
    if (!removed) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    
    res.status(204).end();
  });

  // Skills
  router.get("/skills", (_req: Request, res: Response) => {
    const skills = deps.skills.findAll();
    res.json(skills);
  });

  router.post("/skills", (req: Request, res: Response) => {
    const { name, description, fileName, content } = req.body as { 
      name?: string; 
      description?: string;
      fileName?: string; 
      content?: string; 
    };
    
    if (!name || !fileName || !content) {
      res.status(400).json({ error: "name, fileName, and content are required" });
      return;
    }
    
    try {
      const skill = deps.skills.create({
        name,
        description: description || '',
        fileName,
        content,
      });
      res.status(201).json(skill);
    } catch (error) {
      res.status(400).json({ error: "Skill with this filename already exists or invalid data" });
    }
  });

  router.get("/skills/:id", (req: Request, res: Response) => {
    const skill = deps.skills.findById(req.params.id);
    if (!skill) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }
    res.json(skill);
  });

  router.put("/skills/:id", (req: Request, res: Response) => {
    const { name, description, fileName, content } = req.body as Partial<{
      name: string;
      description: string;
      fileName: string;
      content: string;
    }>;

    const success = deps.skills.update(req.params.id, {
      name,
      description,
      fileName,
      content,
    });
    
    if (!success) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }

    const updated = deps.skills.findById(req.params.id);
    res.json(updated);
  });

  router.delete("/skills/:id", (req: Request, res: Response) => {
    const removed = deps.skills.remove(req.params.id);
    if (!removed) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }
    res.status(204).end();
  });

  router.post("/skills/:id/publish", async (req: Request, res: Response) => {
    const skillId = req.params.id;
    const { outputDir } = req.body as { outputDir?: string };
    
    const publishPath = outputDir || deps.skillsPublishPath;

    try {
      const filePath = await deps.skillPublisher.publishToFile(skillId, publishPath);
      res.json({ 
        success: true, 
        filePath,
        message: `Skill published to ${filePath}` 
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      deps.logger.error({ skillId, error, publishPath }, "Failed to publish skill");
      res.status(404).json({ error: message });
    }
  });

  router.post("/skills/:id/execute", async (req: Request, res: Response) => {
    if (!deps.skillRunner) {
      res.status(503).json({ error: "Skill execution runtime is not configured" });
      return;
    }

    const { profile, params } = req.body as { profile?: string; params?: Record<string, unknown> };
    try {
      const result = await deps.skillRunner.executeSkill(req.params.id, { profile, params });
      if (!result.success) {
        res.status(400).json(result);
        return;
      }
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      deps.logger.error({ error, skillId: req.params.id, profile }, "Failed to execute skill");
      res.status(500).json({ error: message });
    }
  });

  // Tools
  router.get("/tools", (_req: Request, res: Response) => {
    const tools = deps.tools.findAll();
    res.json(tools);
  });

  router.post("/tools", (req: Request, res: Response) => {
    const { name, description, fileName, content } = req.body as { 
      name?: string; 
      description?: string;
      fileName?: string; 
      content?: string; 
    };
    
    if (!name || !fileName || !content) {
      res.status(400).json({ error: "name, fileName, and content are required" });
      return;
    }
    
    try {
      const tool = deps.tools.create({
        name,
        description: description || '',
        fileName,
        content,
      });
      res.status(201).json(tool);
    } catch (error) {
      res.status(400).json({ error: "Tool with this filename already exists or invalid data" });
    }
  });

  router.get("/tools/:id", (req: Request, res: Response) => {
    const tool = deps.tools.findById(req.params.id);
    if (!tool) {
      res.status(404).json({ error: "Tool not found" });
      return;
    }
    res.json(tool);
  });

  router.put("/tools/:id", (req: Request, res: Response) => {
    const { name, description, fileName, content } = req.body as Partial<{
      name: string;
      description: string;
      fileName: string;
      content: string;
    }>;

    const success = deps.tools.update(req.params.id, {
      name,
      description,
      fileName,
      content,
    });
    
    if (!success) {
      res.status(404).json({ error: "Tool not found" });
      return;
    }

    const updated = deps.tools.findById(req.params.id);
    res.json(updated);
  });

  router.delete("/tools/:id", (req: Request, res: Response) => {
    const removed = deps.tools.remove(req.params.id);
    if (!removed) {
      res.status(404).json({ error: "Tool not found" });
      return;
    }
    res.status(204).end();
  });

  // Services
  router.get("/services", (_req: Request, res: Response) => {
    const services = deps.services.findAll();
    res.json(services);
  });

  router.post("/services", (req: Request, res: Response) => {
    const { name, description, provider, baseUrl, authType, status } = req.body as {
      name?: string; description?: string; provider?: string; baseUrl?: string;
      authType?: string; status?: string;
    };
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    try {
      const service = deps.services.create({
        name,
        description: description || '',
        provider: provider || '',
        baseUrl: baseUrl || '',
        authType: (authType as any) || 'none',
        status: (status as any) || 'active',
      });
      res.status(201).json(service);
    } catch (error) {
      res.status(400).json({ error: "Failed to create service" });
    }
  });

  router.get("/services/:id", (req: Request, res: Response) => {
    const service = deps.services.findById(req.params.id);
    if (!service) {
      res.status(404).json({ error: "Service not found" });
      return;
    }
    res.json(service);
  });

  router.put("/services/:id", (req: Request, res: Response) => {
    const { name, description, provider, baseUrl, authType, status } = req.body as Partial<{
      name: string; description: string; provider: string; baseUrl: string;
      authType: string; status: string;
    }>;
    const success = deps.services.update(req.params.id, {
      name, description, provider, baseUrl,
      authType: authType as any,
      status: status as any,
    });
    if (!success) {
      res.status(404).json({ error: "Service not found" });
      return;
    }
    const updated = deps.services.findById(req.params.id);
    res.json(updated);
  });

  router.delete("/services/:id", (req: Request, res: Response) => {
    const removed = deps.services.remove(req.params.id);
    if (!removed) {
      res.status(404).json({ error: "Service not found" });
      return;
    }
    res.status(204).end();
  });

  // Skill templates
  router.get("/skill-templates", (_req: Request, res: Response) => {
    res.json([
      {
        id: "env-setup",
        name: "Environment Setup (Morning Bootstrap)",
        description: "Declarative recipe for setting up your dev environment. Configure tools and profiles to match your workflow.",
        content: JSON.stringify({
          steps: [
            { id: "db-reset", toolId: "YOUR_DB_TOOL_ID", params: { action: "reset", profile: "seeded" } },
            { id: "services-start", toolId: "YOUR_SERVICE_TOOL_ID", params: { action: "start" } },
            { id: "cache-clear", toolId: "YOUR_CACHE_TOOL_ID", params: { scope: "all" } },
          ],
          profiles: {
            "clean-slate": { params: { profile: "empty" } },
            "seeded": { params: { profile: "seeded" } },
            "quick": { stepParams: { "cache-clear": { scope: "local" } } },
          },
        }, null, 2),
      },
      {
        id: "test-prep",
        name: "Test Preparation",
        description: "Prepare environment for running automated tests.",
        content: JSON.stringify({
          steps: [
            { id: "db-reset", toolId: "YOUR_DB_TOOL_ID", params: { action: "reset", profile: "test" } },
            { id: "seed-data", toolId: "YOUR_SEED_TOOL_ID", params: { dataset: "test-fixtures" } },
          ],
          profiles: {
            "unit": { stepParams: { "db-reset": { profile: "empty" } } },
            "integration": { stepParams: { "db-reset": { profile: "seeded" } } },
          },
        }, null, 2),
      },
    ]);
  });

  // Standup report
  router.get("/standup", (req: Request, res: Response) => {
    if (!deps.standupGenerator) {
      res.status(503).json({ error: "Standup generator is not configured" });
      return;
    }

    const hours = req.query.hours ? Number(req.query.hours) : undefined;
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const template = typeof req.query.template === "string" ? req.query.template : undefined;

    try {
      const report = deps.standupGenerator.generate({ hours, projectId, template });
      if (req.query.format === "text") {
        res.type("text/markdown").send(report.markdown);
        return;
      }
      res.json(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      deps.logger.error({ error }, "Failed to generate standup report");
      res.status(500).json({ error: message });
    }
  });

  // Workload adapters
  router.get("/workload/adapters", (_req: Request, res: Response) => {
    if (!deps.workloadAdapters) {
      res.status(503).json({ error: "Workload adapter registry is not configured" });
      return;
    }

    res.json({
      active: deps.workloadAdapters.getActiveName(),
      adapters: deps.workloadAdapters.list(),
    });
  });

  router.post("/workload/adapters/active", (req: Request, res: Response) => {
    if (!deps.workloadAdapters) {
      res.status(503).json({ error: "Workload adapter registry is not configured" });
      return;
    }

    const { name } = req.body as { name?: string };
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const changed = deps.workloadAdapters.setActive(name);
    if (!changed) {
      res.status(404).json({ error: "Adapter not found" });
      return;
    }

    const adapterRecords = deps.workloadAdapterRepository?.findAll() ?? [];
    const targetRecord = adapterRecords.find((record) => record.name === name);
    if (targetRecord && deps.workloadAdapterRepository) {
      deps.workloadAdapterRepository.setActive(targetRecord.id);
    }

    res.json({ active: deps.workloadAdapters.getActiveName() });
  });

  router.get("/workload/tickets", async (req: Request, res: Response) => {
    const activeAdapter = deps.workloadAdapters?.getActiveAdapter();
    if (!activeAdapter) {
      res.status(503).json({ error: "No active workload adapter configured" });
      return;
    }

    const { status, assignee } = req.query as { status?: string; assignee?: string };
    try {
      const normalizedStatus = status?.toLowerCase();
      let tickets: WorkloadTicket[];
      if (normalizedStatus === "backlog") {
        tickets = await activeAdapter.getBacklog();
      } else if (normalizedStatus === "in-progress" || normalizedStatus === "in_progress") {
        tickets = await activeAdapter.getInProgress();
      } else if (assignee === "@me") {
        tickets = await activeAdapter.getMyWork();
      } else {
        const [backlog, inProgress] = await Promise.all([
          activeAdapter.getBacklog(),
          activeAdapter.getInProgress(),
        ]);

        const merged = new Map<string, WorkloadTicket>();
        for (const ticket of [...backlog, ...inProgress]) {
          merged.set(ticket.id, ticket);
        }
        tickets = Array.from(merged.values());
      }

      if (assignee && assignee !== "@me") {
        const assigneeLower = assignee.toLowerCase();
        tickets = tickets.filter((ticket) => ticket.assignee?.toLowerCase() === assigneeLower);
      }

      res.json(tickets);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      deps.logger.error({ error }, "Failed to load workload tickets");
      res.status(500).json({ error: message });
    }
  });

  router.get("/workload/tickets/:id", async (req: Request, res: Response) => {
    const activeAdapter = deps.workloadAdapters?.getActiveAdapter();
    if (!activeAdapter) {
      res.status(503).json({ error: "No active workload adapter configured" });
      return;
    }

    try {
      const ticket = await activeAdapter.getTicket(req.params.id);
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }
      res.json(ticket);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      deps.logger.error({ error, ticketId: req.params.id }, "Failed to load workload ticket");
      res.status(500).json({ error: message });
    }
  });

  router.get("/workload/backlog", async (_req: Request, res: Response) => {
    const activeAdapter = deps.workloadAdapters?.getActiveAdapter();
    if (!activeAdapter) {
      res.status(503).json({ error: "No active workload adapter configured" });
      return;
    }

    try {
      const tickets = await activeAdapter.getBacklog();
      res.json(tickets);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      deps.logger.error({ error }, "Failed to load backlog workload tickets");
      res.status(500).json({ error: message });
    }
  });

  router.get("/workload/in-progress", async (_req: Request, res: Response) => {
    const activeAdapter = deps.workloadAdapters?.getActiveAdapter();
    if (!activeAdapter) {
      res.status(503).json({ error: "No active workload adapter configured" });
      return;
    }

    try {
      const tickets = await activeAdapter.getInProgress();
      res.json(tickets);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      deps.logger.error({ error }, "Failed to load in-progress workload tickets");
      res.status(500).json({ error: message });
    }
  });

  router.post("/workload/tickets/:id/status", async (req: Request, res: Response) => {
    const activeAdapter = deps.workloadAdapters?.getActiveAdapter();
    if (!activeAdapter) {
      res.status(503).json({ error: "No active workload adapter configured" });
      return;
    }

    const { status } = req.body as { status?: string };
    if (!status) {
      res.status(400).json({ error: "status is required" });
      return;
    }

    try {
      const updated = await activeAdapter.updateStatus(req.params.id, status);
      if (!updated) {
        res.status(404).json({ error: "Ticket not found or status update failed" });
        return;
      }
      res.json({ id: req.params.id, status });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      deps.logger.error({ error, ticketId: req.params.id, status }, "Failed to update workload ticket status");
      res.status(500).json({ error: message });
    }
  });

  // Ticket review
  router.post("/workload/review", async (_req: Request, res: Response) => {
    if (!deps.ticketReviewer) {
      res.status(503).json({ error: "Ticket reviewer is not configured" });
      return;
    }

    const activeAdapter = deps.workloadAdapters?.getActiveAdapter();
    if (!activeAdapter) {
      res.status(503).json({ error: "No active workload adapter configured" });
      return;
    }

    try {
      const [backlog, inProgress] = await Promise.all([
        activeAdapter.getBacklog(),
        activeAdapter.getInProgress(),
      ]);

      const allTickets = [...backlog, ...inProgress];
      const ticketsForReview = allTickets.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        labels: t.labels,
        status: t.status,
        assignee: t.assignee ?? undefined,
      }));

      const summary = deps.ticketReviewer.review(ticketsForReview);
      res.json(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      deps.logger.error({ error }, "Failed to review workload tickets");
      res.status(500).json({ error: message });
    }
  });

  // Acceptance testing
  router.post("/workload/tickets/:id/acceptance-test", async (req: Request, res: Response) => {
    if (!deps.acceptanceTestRunner) {
      res.status(503).json({ error: "Acceptance test runner is not configured" });
      return;
    }

    const activeAdapter = deps.workloadAdapters?.getActiveAdapter();
    if (!activeAdapter) {
      res.status(503).json({ error: "No active workload adapter configured" });
      return;
    }

    try {
      const ticket = await activeAdapter.getTicket(req.params.id);
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const { navigationSkill } = req.body as { navigationSkill?: string };
      const summary = await deps.acceptanceTestRunner.run(
        ticket.id,
        ticket.title,
        ticket.description ?? "",
        navigationSkill
      );
      res.json(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      deps.logger.error({ error, ticketId: req.params.id }, "Failed to run acceptance test");
      res.status(500).json({ error: message });
    }
  });

  // External Terminal Launch
  router.post("/terminal/launch", (req: Request, res: Response) => {
    const { agentId, projectPath, prompt } = req.body as {
      agentId?: string;
      projectPath?: string;
      prompt?: string;
    };

    try {
      // Get agent configuration
      const agent = agentId ? deps.agentDefinitions.findById(agentId) : deps.agentDefinitions.findPrimary();
      if (!agent) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }

      // For now, just return success - external terminal launching
      // would be implemented based on the platform
      res.json({ 
        success: true, 
        message: `Would launch ${agent.name} in external terminal`,
        agent: agent.name,
        command: `${agent.command} ${agent.defaultArgs.join(' ')}`
      });
    } catch (error) {
      deps.logger.error({ error }, "Failed to launch external terminal");
      res.status(500).json({ error: "Failed to launch terminal" });
    }
  });

  return router;
}
