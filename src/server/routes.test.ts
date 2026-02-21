import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { createApiRouter, type RoutesDeps } from "./routes.js";
import type { 
  ProjectRepository, 
  TicketRepository, 
  AgentRunRepository, 
  AgentDefinitionRepository,
  Project,
  Ticket,
  AgentRun,
  AgentDefinition,
  TicketStage 
} from "../db/types.js";
import type { Logger } from "../logger.js";

// Mock implementations
const mockLogger: Logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => mockLogger),
} as any;

const createMockProject = (id: number, name: string, location: string): Project => ({
  id,
  name,
  location,
  createdAt: new Date().toISOString(),
});

const createMockTicket = (id: number, title: string, stage: TicketStage = "open", projectId?: number): Ticket => ({
  id,
  title,
  stage,
  projectId: projectId ?? null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const createMockAgentRun = (id: string, agent: string): AgentRun => ({
  id,
  agent,
  prompt: "Test prompt",
  cwd: "/test",
  model: null,
  status: "completed",
  exitCode: 0,
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
});

const createMockAgentDefinition = (id: string, name: string, isPrimary = false): AgentDefinition => ({
  id,
  name,
  command: "test-command",
  defaultArgs: ["--test"],
  model: null,
  isPrimary,
});

describe("API Routes", () => {
  let app: express.Application;
  let mockProjects: ProjectRepository;
  let mockTickets: TicketRepository;
  let mockAgentRuns: AgentRunRepository;
  let mockAgentDefinitions: AgentDefinitionRepository;
  let deps: RoutesDeps;

  beforeEach(() => {
    // Create mock repositories
    mockProjects = {
      create: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn(),
      remove: vi.fn(),
    };

    mockTickets = {
      create: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn(),
      updateStage: vi.fn(),
      updateProject: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    mockAgentRuns = {
      create: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn(),
      updateStatus: vi.fn(),
    };

    mockAgentDefinitions = {
      create: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn(),
      findPrimary: vi.fn(),
      update: vi.fn(),
      setPrimary: vi.fn(),
      remove: vi.fn(),
    };

    deps = {
      projects: mockProjects,
      tickets: mockTickets,
      agentRuns: mockAgentRuns,
      agentDefinitions: mockAgentDefinitions,
      services: {
        create: vi.fn(),
        findAll: vi.fn().mockReturnValue([]),
        findById: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      },
      logger: mockLogger,
    };

    app = express();
    app.use(express.json());
    app.use("/api", createApiRouter(deps));
  });

  describe("Health API", () => {
    describe("GET /api/health", () => {
      it("returns health status", async () => {
        const response = await request(app).get("/api/health");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "ok" });
      });
    });
  });

  describe("Projects API", () => {
    describe("GET /api/projects", () => {
      it("returns all projects", async () => {
        const mockProjectsData = [
          createMockProject(1, "Project 1", "/path/1"),
          createMockProject(2, "Project 2", "/path/2"),
        ];
        vi.mocked(mockProjects.findAll).mockReturnValue(mockProjectsData);

        const response = await request(app).get("/api/projects");

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockProjectsData);
        expect(mockProjects.findAll).toHaveBeenCalled();
      });
    });

    describe("POST /api/projects", () => {
      it("creates a new project", async () => {
        const newProject = createMockProject(1, "New Project", "/path/new");
        vi.mocked(mockProjects.create).mockReturnValue(newProject);

        const response = await request(app)
          .post("/api/projects")
          .send({ name: "New Project", location: "/path/new" });

        expect(response.status).toBe(201);
        expect(response.body).toEqual(newProject);
        expect(mockProjects.create).toHaveBeenCalledWith("New Project", "/path/new");
      });

      it("returns 400 when name is missing", async () => {
        const response = await request(app)
          .post("/api/projects")
          .send({ location: "/path/new" });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "name and location are required" });
        expect(mockProjects.create).not.toHaveBeenCalled();
      });

      it("returns 400 when location is missing", async () => {
        const response = await request(app)
          .post("/api/projects")
          .send({ name: "New Project" });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "name and location are required" });
        expect(mockProjects.create).not.toHaveBeenCalled();
      });
    });

    describe("DELETE /api/projects/:id", () => {
      it("deletes an existing project", async () => {
        vi.mocked(mockProjects.remove).mockReturnValue(true);

        const response = await request(app).delete("/api/projects/1");

        expect(response.status).toBe(204);
        expect(mockProjects.remove).toHaveBeenCalledWith(1);
      });

      it("returns 404 when project not found", async () => {
        vi.mocked(mockProjects.remove).mockReturnValue(false);

        const response = await request(app).delete("/api/projects/999");

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "Project not found" });
      });
    });
  });

  describe("Tickets API", () => {
    describe("GET /api/tickets", () => {
      it("returns all tickets", async () => {
        const mockTicketsData = [
          createMockTicket(1, "Ticket 1"),
          createMockTicket(2, "Ticket 2", "closed"),
        ];
        vi.mocked(mockTickets.findAll).mockReturnValue(mockTicketsData);

        const response = await request(app).get("/api/tickets");

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockTicketsData);
        expect(mockTickets.findAll).toHaveBeenCalled();
      });
    });

    describe("POST /api/tickets", () => {
      it("creates a new ticket", async () => {
        const newTicket = createMockTicket(1, "New Ticket");
        vi.mocked(mockTickets.create).mockReturnValue(newTicket);

        const response = await request(app)
          .post("/api/tickets")
          .send({ title: "New Ticket" });

        expect(response.status).toBe(201);
        expect(response.body).toEqual(newTicket);
        expect(mockTickets.create).toHaveBeenCalledWith("New Ticket", undefined);
      });

      it("creates a new ticket with project ID", async () => {
        const newTicket = createMockTicket(1, "New Ticket", "open", 5);
        vi.mocked(mockTickets.create).mockReturnValue(newTicket);

        const response = await request(app)
          .post("/api/tickets")
          .send({ title: "New Ticket", projectId: 5 });

        expect(response.status).toBe(201);
        expect(response.body).toEqual(newTicket);
        expect(mockTickets.create).toHaveBeenCalledWith("New Ticket", 5);
      });

      it("returns 400 when title is missing", async () => {
        const response = await request(app)
          .post("/api/tickets")
          .send({ projectId: 1 });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "title is required" });
        expect(mockTickets.create).not.toHaveBeenCalled();
      });
    });

    describe("PATCH /api/tickets/:id/stage", () => {
      it("updates ticket stage", async () => {
        vi.mocked(mockTickets.updateStage).mockReturnValue(true);

        const response = await request(app)
          .patch("/api/tickets/1/stage")
          .send({ stage: "closed" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ id: 1, stage: "closed" });
        expect(mockTickets.updateStage).toHaveBeenCalledWith(1, "closed");
      });

      it("returns 404 when ticket not found", async () => {
        vi.mocked(mockTickets.updateStage).mockReturnValue(false);

        const response = await request(app)
          .patch("/api/tickets/999/stage")
          .send({ stage: "closed" });

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "Ticket not found" });
      });

      it("returns 400 when stage is missing", async () => {
        const response = await request(app)
          .patch("/api/tickets/1/stage")
          .send({});

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "stage is required" });
        expect(mockTickets.updateStage).not.toHaveBeenCalled();
      });
    });

    describe("PATCH /api/tickets/:id", () => {
      it("updates ticket fields", async () => {
        vi.mocked(mockTickets.findById).mockReturnValue({
          id: 1, title: "Updated", stage: "open", projectId: 2, createdAt: "2024-01-01", updatedAt: "2024-01-01"
        });
        vi.mocked(mockTickets.update).mockReturnValue(true);

        const response = await request(app)
          .patch("/api/tickets/1")
          .send({ title: "Updated", projectId: 2 });

        expect(response.status).toBe(200);
        expect(mockTickets.update).toHaveBeenCalledWith(1, { title: "Updated", projectId: 2 });
      });

      it("returns 404 when ticket not found", async () => {
        vi.mocked(mockTickets.findById).mockReturnValue(undefined);

        const response = await request(app)
          .patch("/api/tickets/999")
          .send({ title: "x" });

        expect(response.status).toBe(404);
      });

      it("returns 400 when no updates provided", async () => {
        vi.mocked(mockTickets.findById).mockReturnValue({
          id: 1, title: "Test", stage: "open", projectId: null, createdAt: "2024-01-01", updatedAt: "2024-01-01"
        });

        const response = await request(app)
          .patch("/api/tickets/1")
          .send({});

        expect(response.status).toBe(400);
      });
    });

    describe("DELETE /api/tickets/:id", () => {
      it("deletes an existing ticket", async () => {
        vi.mocked(mockTickets.remove).mockReturnValue(true);

        const response = await request(app).delete("/api/tickets/1");

        expect(response.status).toBe(204);
        expect(mockTickets.remove).toHaveBeenCalledWith(1);
      });

      it("returns 404 when ticket not found", async () => {
        vi.mocked(mockTickets.remove).mockReturnValue(false);

        const response = await request(app).delete("/api/tickets/999");

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "Ticket not found" });
      });
    });
  });

  describe("Agent Runs API", () => {
    describe("GET /api/agent-runs", () => {
      it("returns agent runs with default limit", async () => {
        const mockRunsData = [
          createMockAgentRun("run1", "copilot"),
          createMockAgentRun("run2", "claude"),
        ];
        vi.mocked(mockAgentRuns.findAll).mockReturnValue(mockRunsData);

        const response = await request(app).get("/api/agent-runs");

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockRunsData);
        expect(mockAgentRuns.findAll).toHaveBeenCalledWith(50);
      });

      it("returns agent runs with custom limit", async () => {
        const mockRunsData = [createMockAgentRun("run1", "copilot")];
        vi.mocked(mockAgentRuns.findAll).mockReturnValue(mockRunsData);

        const response = await request(app).get("/api/agent-runs?limit=10");

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockRunsData);
        expect(mockAgentRuns.findAll).toHaveBeenCalledWith(10);
      });
    });
  });

  describe("Agent Definitions API", () => {
    describe("GET /api/agents", () => {
      it("returns all agent definitions", async () => {
        const mockAgentsData = [
          createMockAgentDefinition("copilot", "Copilot CLI", true),
          createMockAgentDefinition("claude", "Claude Code", false),
        ];
        vi.mocked(mockAgentDefinitions.findAll).mockReturnValue(mockAgentsData);

        const response = await request(app).get("/api/agents");

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockAgentsData);
        expect(mockAgentDefinitions.findAll).toHaveBeenCalled();
      });
    });

    describe("GET /api/agents/primary", () => {
      it("returns primary agent", async () => {
        const primaryAgent = createMockAgentDefinition("copilot", "Copilot CLI", true);
        vi.mocked(mockAgentDefinitions.findPrimary).mockReturnValue(primaryAgent);

        const response = await request(app).get("/api/agents/primary");

        expect(response.status).toBe(200);
        expect(response.body).toEqual(primaryAgent);
        expect(mockAgentDefinitions.findPrimary).toHaveBeenCalled();
      });

      it("returns 404 when no primary agent exists", async () => {
        vi.mocked(mockAgentDefinitions.findPrimary).mockReturnValue(undefined);

        const response = await request(app).get("/api/agents/primary");

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "No primary agent configured" });
      });
    });

    describe("POST /api/agents", () => {
      it("creates a new agent definition", async () => {
        const newAgent = createMockAgentDefinition("new-agent", "New Agent");
        vi.mocked(mockAgentDefinitions.create).mockReturnValue(newAgent);

        const agentData = {
          id: "new-agent",
          name: "New Agent",
          command: "new-command",
          defaultArgs: ["--arg1", "--arg2"],
          model: "gpt-4",
        };

        const response = await request(app)
          .post("/api/agents")
          .send(agentData);

        expect(response.status).toBe(201);
        expect(response.body).toEqual(newAgent);
        expect(mockAgentDefinitions.create).toHaveBeenCalledWith({
          id: "new-agent",
          name: "New Agent",
          command: "new-command",
          defaultArgs: ["--arg1", "--arg2"],
          model: "gpt-4",
        });
      });

      it("creates a new agent definition with null model", async () => {
        const newAgent = createMockAgentDefinition("new-agent", "New Agent");
        vi.mocked(mockAgentDefinitions.create).mockReturnValue(newAgent);

        const agentData = {
          id: "new-agent",
          name: "New Agent",
          command: "new-command",
          defaultArgs: ["--arg1", "--arg2"],
        };

        const response = await request(app)
          .post("/api/agents")
          .send(agentData);

        expect(response.status).toBe(201);
        expect(mockAgentDefinitions.create).toHaveBeenCalledWith({
          id: "new-agent",
          name: "New Agent",
          command: "new-command",
          defaultArgs: ["--arg1", "--arg2"],
          model: null,
        });
      });

      it("returns 400 when required fields are missing", async () => {
        const response = await request(app)
          .post("/api/agents")
          .send({ name: "Incomplete Agent" });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "id, name, command, and defaultArgs are required" });
        expect(mockAgentDefinitions.create).not.toHaveBeenCalled();
      });

      it("returns 400 when defaultArgs is not an array", async () => {
        const response = await request(app)
          .post("/api/agents")
          .send({
            id: "test",
            name: "Test Agent",
            command: "test",
            defaultArgs: "not-an-array",
          });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "id, name, command, and defaultArgs are required" });
      });

      it("returns 400 when agent ID already exists", async () => {
        vi.mocked(mockAgentDefinitions.create).mockImplementation(() => {
          throw new Error("Agent ID already exists");
        });

        const response = await request(app)
          .post("/api/agents")
          .send({
            id: "existing-agent",
            name: "Test Agent",
            command: "test",
            defaultArgs: ["--test"],
          });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "Agent ID already exists" });
      });
    });

    describe("PUT /api/agents/:id", () => {
      it("updates an existing agent", async () => {
        const updatedAgent = createMockAgentDefinition("test-agent", "Updated Agent");
        vi.mocked(mockAgentDefinitions.update).mockReturnValue(true);
        vi.mocked(mockAgentDefinitions.findById).mockReturnValue(updatedAgent);

        const updates = {
          name: "Updated Agent",
          command: "updated-command",
        };

        const response = await request(app)
          .put("/api/agents/test-agent")
          .send(updates);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(updatedAgent);
        expect(mockAgentDefinitions.update).toHaveBeenCalledWith("test-agent", updates);
        expect(mockAgentDefinitions.findById).toHaveBeenCalledWith("test-agent");
      });

      it("returns 404 when agent not found", async () => {
        vi.mocked(mockAgentDefinitions.update).mockReturnValue(false);

        const response = await request(app)
          .put("/api/agents/nonexistent")
          .send({ name: "Updated Name" });

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "Agent not found" });
      });
    });

    describe("POST /api/agents/:id/set-primary", () => {
      it("sets agent as primary", async () => {
        vi.mocked(mockAgentDefinitions.setPrimary).mockReturnValue(true);

        const response = await request(app).post("/api/agents/test-agent/set-primary");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ id: "test-agent", isPrimary: true });
        expect(mockAgentDefinitions.setPrimary).toHaveBeenCalledWith("test-agent");
      });

      it("returns 404 when agent not found", async () => {
        vi.mocked(mockAgentDefinitions.setPrimary).mockReturnValue(false);

        const response = await request(app).post("/api/agents/nonexistent/set-primary");

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "Agent not found" });
      });
    });

    describe("DELETE /api/agents/:id", () => {
      it("deletes a non-primary agent", async () => {
        const agent = createMockAgentDefinition("test-agent", "Test Agent", false);
        vi.mocked(mockAgentDefinitions.findById).mockReturnValue(agent);
        vi.mocked(mockAgentDefinitions.remove).mockReturnValue(true);

        const response = await request(app).delete("/api/agents/test-agent");

        expect(response.status).toBe(204);
        expect(mockAgentDefinitions.remove).toHaveBeenCalledWith("test-agent");
      });

      it("returns 404 when agent not found", async () => {
        vi.mocked(mockAgentDefinitions.findById).mockReturnValue(undefined);

        const response = await request(app).delete("/api/agents/nonexistent");

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "Agent not found" });
        expect(mockAgentDefinitions.remove).not.toHaveBeenCalled();
      });

      it("returns 400 when trying to delete primary agent", async () => {
        const primaryAgent = createMockAgentDefinition("primary-agent", "Primary Agent", true);
        vi.mocked(mockAgentDefinitions.findById).mockReturnValue(primaryAgent);

        const response = await request(app).delete("/api/agents/primary-agent");

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "Cannot delete primary agent" });
        expect(mockAgentDefinitions.remove).not.toHaveBeenCalled();
      });
    });
  });

  describe("Workload API", () => {
    it("lists registered adapters", async () => {
      deps.workloadAdapters = {
        list: vi.fn().mockReturnValue([{ name: "github", isActive: true }]),
        getActiveName: vi.fn().mockReturnValue("github"),
      } as any;

      const response = await request(app).get("/api/workload/adapters");

      expect(response.status).toBe(200);
      expect(response.body.active).toBe("github");
      expect(response.body.adapters).toEqual([{ name: "github", isActive: true }]);
    });

    it("returns backlog from active adapter", async () => {
      deps.workloadAdapters = {
        getActiveAdapter: vi.fn().mockReturnValue({
          getBacklog: vi.fn().mockResolvedValue([
            {
              id: "92",
              title: "Issue 92",
              description: "desc",
              status: "backlog",
              assignee: null,
              labels: ["backlog"],
              url: "https://example.com/92",
              source: "github",
            },
          ]),
        }),
      } as any;

      const response = await request(app).get("/api/workload/backlog");

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe("92");
    });
  });

  describe("Skill Execution API", () => {
    it("executes skill with profile", async () => {
      deps.skillRunner = {
        executeSkill: vi.fn().mockResolvedValue({
          success: true,
          profile: "fast",
          steps: [],
          output: ["ok"],
        }),
      } as any;

      const response = await request(app)
        .post("/api/skills/skill-1/execute")
        .send({ profile: "fast" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(deps.skillRunner.executeSkill).toHaveBeenCalledWith("skill-1", { profile: "fast", params: undefined });
    });
  });

  describe("Terminal API", () => {
    describe("POST /api/terminal/launch", () => {
      it("launches terminal with specific agent", async () => {
        const agent = createMockAgentDefinition("copilot", "Copilot CLI", true);
        vi.mocked(mockAgentDefinitions.findById).mockReturnValue(agent);

        const response = await request(app)
          .post("/api/terminal/launch")
          .send({
            agentId: "copilot",
            projectPath: "/path/to/project",
            prompt: "Test prompt",
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.agent).toBe("Copilot CLI");
        expect(response.body.command).toBe("test-command --test");
        expect(mockAgentDefinitions.findById).toHaveBeenCalledWith("copilot");
      });

      it("launches terminal with primary agent when no agentId specified", async () => {
        const primaryAgent = createMockAgentDefinition("copilot", "Copilot CLI", true);
        vi.mocked(mockAgentDefinitions.findPrimary).mockReturnValue(primaryAgent);

        const response = await request(app).post("/api/terminal/launch").send({});

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.agent).toBe("Copilot CLI");
        expect(mockAgentDefinitions.findPrimary).toHaveBeenCalled();
      });

      it("returns 404 when specified agent not found", async () => {
        vi.mocked(mockAgentDefinitions.findById).mockReturnValue(undefined);

        const response = await request(app)
          .post("/api/terminal/launch")
          .send({ agentId: "nonexistent" });

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "Agent not found" });
      });

      it("returns 404 when no primary agent exists", async () => {
        vi.mocked(mockAgentDefinitions.findPrimary).mockReturnValue(undefined);

        const response = await request(app).post("/api/terminal/launch").send({});

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "Agent not found" });
      });

      it("returns 500 on internal error", async () => {
        vi.mocked(mockAgentDefinitions.findPrimary).mockImplementation(() => {
          throw new Error("Database error");
        });

        const response = await request(app).post("/api/terminal/launch").send({});

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Failed to launch terminal" });
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });
  });
});
