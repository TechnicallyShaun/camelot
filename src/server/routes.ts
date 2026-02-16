import { Router, type Request, type Response } from "express";
import type { ProjectRepository, TicketRepository, AgentRunRepository, AgentDefinitionRepository, SkillRepository, ToolRepository, SkillPublisher, SdpPlanReader, TicketActivityRepository, DailySummaryGenerator, TicketStage } from "../db/types.js";
import type { Logger } from "../logger.js";

export interface RoutesDeps {
  readonly projects: ProjectRepository;
  readonly tickets: TicketRepository;
  readonly agentRuns: AgentRunRepository;
  readonly agentDefinitions: AgentDefinitionRepository;
  readonly skills: SkillRepository;
  readonly tools: ToolRepository;
  readonly skillPublisher: SkillPublisher;
  readonly skillsPublishPath: string;
  readonly sdpPlanReader: SdpPlanReader;
  readonly sdpPlansPath: string | null;
  readonly ticketActivity: TicketActivityRepository;
  readonly dailySummaryGenerator: DailySummaryGenerator;
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
