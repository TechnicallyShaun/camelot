import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteDatabase, SqliteProjectRepository, SqliteTicketRepository, SqliteAgentRunRepository } from "./sqlite.js";
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
    expect(ticket.stage).toBe("inbox");
  });

  it("updates ticket stage", () => {
    const ticket = repo.create("Stage test");
    const updated = repo.updateStage(ticket.id, "development");
    expect(updated).toBe(true);
    const found = repo.findById(ticket.id);
    expect(found?.stage).toBe("development");
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
