import { Router, type Request, type Response } from "express";
import type { ProjectRepository, TicketRepository, AgentRunRepository, TicketStage } from "../db/types.js";
import type { Logger } from "../logger.js";

export interface RoutesDeps {
  readonly projects: ProjectRepository;
  readonly tickets: TicketRepository;
  readonly agentRuns: AgentRunRepository;
  readonly logger: Logger;
}

export function createApiRouter(deps: RoutesDeps): Router {
  const router = Router();

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

  return router;
}
