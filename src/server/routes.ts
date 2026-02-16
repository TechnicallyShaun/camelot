import { Router, type Request, type Response } from "express";
import type { ProjectRepository, TicketRepository, AgentRunRepository, AgentDefinitionRepository, TicketStage } from "../db/types.js";
import type { Logger } from "../logger.js";

export interface RoutesDeps {
  readonly projects: ProjectRepository;
  readonly tickets: TicketRepository;
  readonly agentRuns: AgentRunRepository;
  readonly agentDefinitions: AgentDefinitionRepository;
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
    res.json({ id, stage });
  });

  router.delete("/tickets/:id", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const removed = deps.tickets.remove(id);
    if (!removed) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.status(204).end();
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
