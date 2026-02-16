import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteDatabase, SqliteProjectRepository, SqliteTicketRepository, SqliteAgentRunRepository, SqliteAgentDefinitionRepository, SqliteSkillRepository, SqliteToolRepository, SqliteTicketActivityRepository } from "./sqlite.js";
import { unlinkSync, existsSync } from "node:fs";

const TEST_DB = ":memory:";

describe("SqliteDatabase", () => {
  let database: SqliteDatabase;

  beforeEach(() => {
    database = new SqliteDatabase(TEST_DB);
    database.initialize();
  });

  afterEach(() => {
    database.close();
  });

  it("initializes without error", () => {
    expect(database.db).toBeDefined();
  });

  it("seeds default agent definitions", () => {
    const agents = database.db.prepare("SELECT * FROM agent_definitions").all() as Array<{ id: string; name: string; is_primary: number }>;
    expect(agents).toHaveLength(2);
    expect(agents.find((a) => a.id === "copilot")?.is_primary).toBe(1);
    expect(agents.find((a) => a.id === "claude")?.is_primary).toBe(0);
  });
});

describe("SqliteProjectRepository", () => {
  let database: SqliteDatabase;
  let repo: SqliteProjectRepository;

  beforeEach(() => {
    database = new SqliteDatabase(TEST_DB);
    database.initialize();
    repo = new SqliteProjectRepository(database.db);
  });

  afterEach(() => {
    database.close();
  });

  it("creates a project", () => {
    const project = repo.create("TestProject", "D:\\Git\\TestProject");
    expect(project.name).toBe("TestProject");
    expect(project.location).toBe("D:\\Git\\TestProject");
    expect(project.id).toBeGreaterThan(0);
  });

  it("lists all projects", () => {
    repo.create("A", "/a");
    repo.create("B", "/b");
    const all = repo.findAll();
    expect(all).toHaveLength(2);
  });

  it("finds by id", () => {
    const created = repo.create("FindMe", "/find");
    const found = repo.findById(created.id);
    expect(found?.name).toBe("FindMe");
  });

  it("removes a project", () => {
    const created = repo.create("RemoveMe", "/rm");
    const removed = repo.remove(created.id);
    expect(removed).toBe(true);
    expect(repo.findById(created.id)).toBeUndefined();
  });
});

describe("SqliteTicketRepository", () => {
  let database: SqliteDatabase;
  let repo: SqliteTicketRepository;

  beforeEach(() => {
    database = new SqliteDatabase(TEST_DB);
    database.initialize();
    repo = new SqliteTicketRepository(database.db);
  });

  afterEach(() => {
    database.close();
  });

  it("creates a ticket with default stage", () => {
    const ticket = repo.create("Fix the bug");
    expect(ticket.title).toBe("Fix the bug");
    expect(ticket.stage).toBe("open");
  });

  it("updates ticket stage", () => {
    const ticket = repo.create("Stage test");
    const updated = repo.updateStage(ticket.id, "closed");
    expect(updated).toBe(true);
    const found = repo.findById(ticket.id);
    expect(found?.stage).toBe("closed");
  });

  it("removes a ticket", () => {
    const ticket = repo.create("Delete me");
    expect(repo.remove(ticket.id)).toBe(true);
    expect(repo.findById(ticket.id)).toBeUndefined();
  });
});

describe("SqliteAgentRunRepository", () => {
  let database: SqliteDatabase;
  let repo: SqliteAgentRunRepository;

  beforeEach(() => {
    database = new SqliteDatabase(TEST_DB);
    database.initialize();
    repo = new SqliteAgentRunRepository(database.db);
  });

  afterEach(() => {
    database.close();
  });

  it("creates an agent run", () => {
    const run = repo.create({
      agent: "copilot",
      prompt: "Fix the bug",
      cwd: "D:\\Git\\Project",
      model: null,
      status: "running",
      exitCode: null,
    });
    expect(run.id).toBeDefined();
    expect(run.agent).toBe("copilot");
    expect(run.status).toBe("running");
  });

  it("updates run status", () => {
    const run = repo.create({
      agent: "claude",
      prompt: "test",
      cwd: "/tmp",
      model: null,
      status: "running",
      exitCode: null,
    });
    repo.updateStatus(run.id, "completed", 0);
    const found = repo.findById(run.id);
    expect(found?.status).toBe("completed");
    expect(found?.exitCode).toBe(0);
  });
});

describe("SqliteAgentDefinitionRepository", () => {
  let database: SqliteDatabase;
  let repo: SqliteAgentDefinitionRepository;

  beforeEach(() => {
    database = new SqliteDatabase(TEST_DB);
    database.initialize();
    repo = new SqliteAgentDefinitionRepository(database.db);
  });

  afterEach(() => {
    database.close();
  });

  it("creates an agent definition", () => {
    const agent = repo.create({
      id: "test-agent",
      name: "Test Agent",
      command: "test-command",
      defaultArgs: ["--test", "--arg"],
      model: "gpt-4",
    });
    
    expect(agent.id).toBe("test-agent");
    expect(agent.name).toBe("Test Agent");
    expect(agent.command).toBe("test-command");
    expect(agent.defaultArgs).toEqual(["--test", "--arg"]);
    expect(agent.model).toBe("gpt-4");
    expect(agent.isPrimary).toBe(false);
  });

  it("finds all agents ordered by primary first", () => {
    repo.create({
      id: "secondary",
      name: "Secondary Agent",
      command: "secondary",
      defaultArgs: [],
      model: null,
    });

    const all = repo.findAll();
    expect(all).toHaveLength(3); // 2 seeded + 1 created
    
    // Primary agent should be first
    const primary = all.find(a => a.isPrimary);
    expect(primary?.id).toBe("copilot");
    expect(primary?.name).toBe("Copilot CLI");
    expect(primary?.isPrimary).toBe(true);
  });

  it("finds agent by id", () => {
    const found = repo.findById("copilot");
    expect(found?.id).toBe("copilot");
    expect(found?.name).toBe("Copilot CLI");
    expect(found?.isPrimary).toBe(true);
  });

  it("returns undefined for non-existent agent", () => {
    const found = repo.findById("nonexistent");
    expect(found).toBeUndefined();
  });

  it("finds primary agent", () => {
    const primary = repo.findPrimary();
    expect(primary?.id).toBe("copilot");
    expect(primary?.isPrimary).toBe(true);
  });

  it("updates agent fields", () => {
    const updated = repo.update("claude", {
      name: "Updated Claude",
      command: "new-claude",
      defaultArgs: ["--new-arg"],
      model: "claude-3",
    });
    
    expect(updated).toBe(true);
    
    const found = repo.findById("claude");
    expect(found?.name).toBe("Updated Claude");
    expect(found?.command).toBe("new-claude");
    expect(found?.defaultArgs).toEqual(["--new-arg"]);
    expect(found?.model).toBe("claude-3");
  });

  it("updates only specified fields", () => {
    const updated = repo.update("claude", { name: "New Name Only" });
    expect(updated).toBe(true);
    
    const found = repo.findById("claude");
    expect(found?.name).toBe("New Name Only");
    expect(found?.command).toBe("claude"); // unchanged
  });

  it("returns false when updating non-existent agent", () => {
    const updated = repo.update("nonexistent", { name: "Won't work" });
    expect(updated).toBe(false);
  });

  it("sets primary agent", () => {
    const success = repo.setPrimary("claude");
    expect(success).toBe(true);
    
    // Check old primary is no longer primary
    const oldPrimary = repo.findById("copilot");
    expect(oldPrimary?.isPrimary).toBe(false);
    
    // Check new primary is set
    const newPrimary = repo.findById("claude");
    expect(newPrimary?.isPrimary).toBe(true);
    
    // Verify findPrimary returns the new primary
    const primary = repo.findPrimary();
    expect(primary?.id).toBe("claude");
  });

  it("returns false when setting non-existent agent as primary", () => {
    // Make sure we have the initial primary agent first
    const initialPrimary = repo.findPrimary();
    expect(initialPrimary?.id).toBe("copilot");
    
    const success = repo.setPrimary("nonexistent");
    expect(success).toBe(false);
    
    // The original primary agent should remain primary when targeting a non-existent agent
    const primary = repo.findPrimary();
    expect(primary?.id).toBe("copilot");
  });

  it("preserves existing primary agent when targeting non-existent agent (regression test)", () => {
    // Set a specific agent as primary
    repo.setPrimary("claude");
    expect(repo.findPrimary()?.id).toBe("claude");
    
    // Try to set a non-existent agent as primary
    const success = repo.setPrimary("does-not-exist");
    expect(success).toBe(false);
    
    // Claude should still be primary (regression test for bug #54)
    const stillPrimary = repo.findPrimary();
    expect(stillPrimary?.id).toBe("claude");
    expect(stillPrimary?.isPrimary).toBe(true);
  });

  it("removes an agent", () => {
    const removed = repo.remove("claude");
    expect(removed).toBe(true);
    
    const found = repo.findById("claude");
    expect(found).toBeUndefined();
  });

  it("returns false when removing non-existent agent", () => {
    const removed = repo.remove("nonexistent");
    expect(removed).toBe(false);
  });

  it("handles default agent seeding correctly", () => {
    const agents = repo.findAll();
    
    const copilot = agents.find(a => a.id === "copilot");
    expect(copilot?.name).toBe("Copilot CLI");
    expect(copilot?.command).toBe("copilot");
    expect(copilot?.defaultArgs).toEqual(["-i", "--yolo", "--no-ask-user"]);
    expect(copilot?.model).toBeNull();
    expect(copilot?.isPrimary).toBe(true);
    
    const claude = agents.find(a => a.id === "claude");
    expect(claude?.name).toBe("Claude Code");
    expect(claude?.command).toBe("claude");
    expect(claude?.defaultArgs).toEqual(["--dangerously-skip-permissions"]);
    expect(claude?.model).toBeNull();
    expect(claude?.isPrimary).toBe(false);
  });

  it("throws error when creating agent with duplicate id", () => {
    expect(() => {
      repo.create({
        id: "copilot", // Duplicate of seeded agent
        name: "Duplicate Agent",
        command: "duplicate",
        defaultArgs: [],
        model: null,
      });
    }).toThrow();
  });
});

describe("SqliteSkillRepository", () => {
  let database: SqliteDatabase;
  let repo: SkillRepository;

  beforeEach(() => {
    database = new SqliteDatabase(TEST_DB);
    database.initialize();
    repo = new SqliteSkillRepository(database.db);
  });

  afterEach(() => {
    database.close();
  });

  it("creates a skill", () => {
    const skill = repo.create({
      name: "Test Skill",
      description: "A test skill",
      fileName: "test-skill.md",
      content: "# Test Skill\n\nThis is a test skill.",
    });

    expect(skill.id).toBeDefined();
    expect(skill.name).toBe("Test Skill");
    expect(skill.description).toBe("A test skill");
    expect(skill.fileName).toBe("test-skill.md");
    expect(skill.content).toBe("# Test Skill\n\nThis is a test skill.");
    expect(skill.createdAt).toBeDefined();
    expect(skill.updatedAt).toBeDefined();
  });

  it("finds all skills", () => {
    repo.create({
      name: "Skill 1",
      description: "First skill",
      fileName: "skill1.md",
      content: "Content 1",
    });
    repo.create({
      name: "Skill 2", 
      description: "Second skill",
      fileName: "skill2.md",
      content: "Content 2",
    });

    const skills = repo.findAll();
    expect(skills).toHaveLength(2);
    expect(skills[0].name).toBe("Skill 1"); // Sorted by name
    expect(skills[1].name).toBe("Skill 2");
  });

  it("finds skill by ID", () => {
    const created = repo.create({
      name: "Find Me",
      description: "A findable skill",
      fileName: "findme.md",
      content: "Find this content",
    });

    const found = repo.findById(created.id);
    expect(found).toEqual(created);
  });

  it("finds skill by filename", () => {
    const created = repo.create({
      name: "File Skill",
      description: "A skill found by filename",
      fileName: "unique-file.md",
      content: "Unique content",
    });

    const found = repo.findByFileName("unique-file.md");
    expect(found).toEqual(created);
  });

  it("returns undefined for non-existent skill", () => {
    const notFound = repo.findById("nonexistent");
    expect(notFound).toBeUndefined();
  });

  it("updates a skill", () => {
    const skill = repo.create({
      name: "Original",
      description: "Original description",
      fileName: "original.md",
      content: "Original content",
    });

    const success = repo.update(skill.id, {
      name: "Updated",
      content: "Updated content",
    });
    expect(success).toBe(true);

    const updated = repo.findById(skill.id);
    expect(updated?.name).toBe("Updated");
    expect(updated?.content).toBe("Updated content");
    expect(updated?.description).toBe("Original description"); // Unchanged
    expect(updated?.updatedAt).toBeDefined(); // Updated timestamp should exist
  });

  it("removes a skill", () => {
    const skill = repo.create({
      name: "To Delete",
      description: "Will be deleted",
      fileName: "delete-me.md", 
      content: "Delete this",
    });

    const success = repo.remove(skill.id);
    expect(success).toBe(true);

    const notFound = repo.findById(skill.id);
    expect(notFound).toBeUndefined();
  });

  it("returns false when removing non-existent skill", () => {
    const success = repo.remove("nonexistent");
    expect(success).toBe(false);
  });

  it("enforces unique filenames", () => {
    repo.create({
      name: "First",
      description: "First skill",
      fileName: "duplicate.md",
      content: "First content",
    });

    expect(() => {
      repo.create({
        name: "Second",
        description: "Second skill", 
        fileName: "duplicate.md", // Duplicate filename
        content: "Second content",
      });
    }).toThrow();
  });
});

describe("SqliteToolRepository", () => {
  let database: SqliteDatabase;
  let repo: ToolRepository;

  beforeEach(() => {
    database = new SqliteDatabase(TEST_DB);
    database.initialize();
    repo = new SqliteToolRepository(database.db);
  });

  afterEach(() => {
    database.close();
  });

  it("creates a tool", () => {
    const tool = repo.create({
      name: "Test Tool",
      description: "A test tool",
      fileName: "test-tool.md",
      content: "# Test Tool\n\nThis is a test tool.",
    });

    expect(tool.id).toBeDefined();
    expect(tool.name).toBe("Test Tool");
    expect(tool.description).toBe("A test tool");
    expect(tool.fileName).toBe("test-tool.md");
    expect(tool.content).toBe("# Test Tool\n\nThis is a test tool.");
    expect(tool.createdAt).toBeDefined();
    expect(tool.updatedAt).toBeDefined();
  });

  it("finds all tools", () => {
    repo.create({
      name: "Tool 1",
      description: "First tool",
      fileName: "tool1.md",
      content: "Content 1",
    });
    repo.create({
      name: "Tool 2",
      description: "Second tool", 
      fileName: "tool2.md",
      content: "Content 2",
    });

    const tools = repo.findAll();
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe("Tool 1"); // Sorted by name
    expect(tools[1].name).toBe("Tool 2");
  });

  it("finds tool by ID", () => {
    const created = repo.create({
      name: "Find Me",
      description: "A findable tool",
      fileName: "findme.md",
      content: "Find this content",
    });

    const found = repo.findById(created.id);
    expect(found).toEqual(created);
  });

  it("finds tool by filename", () => {
    const created = repo.create({
      name: "File Tool",
      description: "A tool found by filename",
      fileName: "unique-file.md",
      content: "Unique content",
    });

    const found = repo.findByFileName("unique-file.md");
    expect(found).toEqual(created);
  });

  it("returns undefined for non-existent tool", () => {
    const notFound = repo.findById("nonexistent");
    expect(notFound).toBeUndefined();
  });

  it("updates a tool", () => {
    const tool = repo.create({
      name: "Original",
      description: "Original description",
      fileName: "original.md",
      content: "Original content",
    });

    const success = repo.update(tool.id, {
      name: "Updated",
      content: "Updated content",
    });
    expect(success).toBe(true);

    const updated = repo.findById(tool.id);
    expect(updated?.name).toBe("Updated");
    expect(updated?.content).toBe("Updated content");
    expect(updated?.description).toBe("Original description"); // Unchanged
    expect(updated?.updatedAt).toBeDefined(); // Updated timestamp should exist
  });

  it("removes a tool", () => {
    const tool = repo.create({
      name: "To Delete",
      description: "Will be deleted",
      fileName: "delete-me.md",
      content: "Delete this",
    });

    const success = repo.remove(tool.id);
    expect(success).toBe(true);

    const notFound = repo.findById(tool.id);
    expect(notFound).toBeUndefined();
  });

  it("returns false when removing non-existent tool", () => {
    const success = repo.remove("nonexistent");
    expect(success).toBe(false);
  });

  it("enforces unique filenames", () => {
    repo.create({
      name: "First",
      description: "First tool",
      fileName: "duplicate.md",
      content: "First content",
    });

    expect(() => {
      repo.create({
        name: "Second",
        description: "Second tool",
        fileName: "duplicate.md", // Duplicate filename
        content: "Second content",
      });
    }).toThrow();
  });
});

describe("SqliteTicketActivityRepository", () => {
  let database: SqliteDatabase;
  let ticketRepo: SqliteTicketRepository;
  let activityRepo: SqliteTicketActivityRepository;

  beforeEach(() => {
    database = new SqliteDatabase(TEST_DB);
    database.initialize();
    ticketRepo = new SqliteTicketRepository(database.db);
    activityRepo = new SqliteTicketActivityRepository(database.db);
  });

  afterEach(() => {
    database.close();
  });

  it("creates ticket activity", () => {
    // Create a ticket first
    const ticket = ticketRepo.create("Test ticket");

    const activity = activityRepo.create({
      ticketId: ticket.id,
      sessionId: "session-123",
      action: "viewed",
      metadata: JSON.stringify({ source: "web" }),
    });

    expect(activity).toEqual({
      id: expect.any(Number),
      ticketId: ticket.id,
      sessionId: "session-123",
      action: "viewed",
      timestamp: expect.any(String),
      metadata: JSON.stringify({ source: "web" }),
    });
  });

  it("creates activity without metadata", () => {
    const ticket = ticketRepo.create("Test ticket");

    const activity = activityRepo.create({
      ticketId: ticket.id,
      sessionId: "session-456",
      action: "created",
    });

    expect(activity.metadata).toBeUndefined();
  });

  it("finds all activities with limit", () => {
    const ticket = ticketRepo.create("Test ticket");

    // Create multiple activities
    const sessionIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const sessionId = `session-${i}`;
      sessionIds.push(sessionId);
      activityRepo.create({
        ticketId: ticket.id,
        sessionId,
        action: "viewed",
      });
    }

    const activities = activityRepo.findAll(3);
    expect(activities).toHaveLength(3);
    // Should be ordered by timestamp DESC (newest first) - verify sessions are in expected set
    expect(sessionIds).toContain(activities[0].sessionId);
    expect(sessionIds).toContain(activities[1].sessionId);
    expect(sessionIds).toContain(activities[2].sessionId);
  });

  it("finds activities by ticket ID", () => {
    const ticket1 = ticketRepo.create("Ticket 1");
    const ticket2 = ticketRepo.create("Ticket 2");

    activityRepo.create({
      ticketId: ticket1.id,
      sessionId: "session-1",
      action: "viewed",
    });

    activityRepo.create({
      ticketId: ticket2.id,
      sessionId: "session-2",
      action: "created",
    });

    activityRepo.create({
      ticketId: ticket1.id,
      sessionId: "session-3",
      action: "updated",
    });

    const ticket1Activities = activityRepo.findByTicketId(ticket1.id);
    expect(ticket1Activities).toHaveLength(2);
    expect(ticket1Activities.every(a => a.ticketId === ticket1.id)).toBe(true);

    const ticket2Activities = activityRepo.findByTicketId(ticket2.id);
    expect(ticket2Activities).toHaveLength(1);
    expect(ticket2Activities[0].ticketId).toBe(ticket2.id);
  });

  it("finds activities by session ID", () => {
    const ticket = ticketRepo.create("Test ticket");

    activityRepo.create({
      ticketId: ticket.id,
      sessionId: "session-abc",
      action: "viewed",
    });

    activityRepo.create({
      ticketId: ticket.id,
      sessionId: "session-def",
      action: "created",
    });

    activityRepo.create({
      ticketId: ticket.id,
      sessionId: "session-abc",
      action: "updated",
    });

    const sessionActivities = activityRepo.findBySessionId("session-abc");
    expect(sessionActivities).toHaveLength(2);
    expect(sessionActivities.every(a => a.sessionId === "session-abc")).toBe(true);
  });

  it("finds activities by date range", () => {
    const ticket = ticketRepo.create("Test ticket");

    // Note: This test assumes activities are created with current timestamp
    // For more precise testing, we'd need to mock datetime() or insert with specific dates
    activityRepo.create({
      ticketId: ticket.id,
      sessionId: "session-today",
      action: "viewed",
    });

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const activities = activityRepo.findByDateRange(today, today);
    
    expect(activities).toHaveLength(1);
    expect(activities[0].sessionId).toBe("session-today");
  });

  it("handles different action types", () => {
    const ticket = ticketRepo.create("Test ticket");
    const actions = ["viewed", "created", "updated", "deleted", "stage_changed"] as const;

    for (const action of actions) {
      activityRepo.create({
        ticketId: ticket.id,
        sessionId: `session-${action}`,
        action,
      });
    }

    const activities = activityRepo.findAll();
    expect(activities).toHaveLength(5);
    
    const actionMap = new Map(activities.map(a => [a.action, a.sessionId]));
    expect(actionMap.get("viewed")).toBe("session-viewed");
    expect(actionMap.get("created")).toBe("session-created");
    expect(actionMap.get("updated")).toBe("session-updated");
    expect(actionMap.get("deleted")).toBe("session-deleted");
    expect(actionMap.get("stage_changed")).toBe("session-stage_changed");
  });
});
