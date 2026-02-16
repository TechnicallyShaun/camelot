import BetterSqlite3 from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type {
  Database,
  Project,
  Ticket,
  TicketStage,
  AgentRun,
  AgentDefinition,
  Skill,
  Tool,
  TicketActivity,
  TicketAction,
  ProjectRepository,
  TicketRepository,
  AgentRunRepository,
  AgentDefinitionRepository,
  SkillRepository,
  ToolRepository,
  TicketActivityRepository,
} from "./types.js";

export class SqliteDatabase implements Database {
  readonly db: BetterSqlite3.Database;

  constructor(dbPath: string) {
    this.db = new BetterSqlite3(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }

  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        stage TEXT NOT NULL DEFAULT 'inbox',
        project_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS agent_runs (
        id TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        prompt TEXT NOT NULL,
        cwd TEXT NOT NULL,
        model TEXT,
        status TEXT NOT NULL DEFAULT 'running',
        exit_code INTEGER,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        finished_at TEXT
      );

      CREATE TABLE IF NOT EXISTS agent_definitions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        command TEXT NOT NULL,
        default_args TEXT NOT NULL DEFAULT '[]',
        model TEXT,
        is_primary INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        file_name TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tools (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        file_name TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS ticket_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        action TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        metadata TEXT,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      );
    `);

    this.seedDefaultAgents();
  }

  private seedDefaultAgents(): void {
    const existing = this.db.prepare("SELECT COUNT(*) as count FROM agent_definitions").get() as { count: number };
    if (existing.count > 0) return;

    const insert = this.db.prepare(
      "INSERT INTO agent_definitions (id, name, command, default_args, model, is_primary) VALUES (?, ?, ?, ?, ?, ?)"
    );

    insert.run("copilot", "Copilot CLI", "copilot", JSON.stringify(["-i", "--yolo", "--no-ask-user"]), null, 1);
    insert.run("claude", "Claude Code", "claude", JSON.stringify(["--dangerously-skip-permissions"]), null, 0);
  }

  close(): void {
    this.db.close();
  }
}

export class SqliteProjectRepository implements ProjectRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  create(name: string, location: string): Project {
    const stmt = this.db.prepare("INSERT INTO projects (name, location) VALUES (?, ?) RETURNING *");
    return this.mapProject(stmt.get(name, location) as Record<string, unknown>);
  }

  findAll(): Project[] {
    const rows = this.db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
    return rows.map((r) => this.mapProject(r as Record<string, unknown>));
  }

  findById(id: number): Project | undefined {
    const row = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    return row ? this.mapProject(row as Record<string, unknown>) : undefined;
  }

  remove(id: number): boolean {
    const result = this.db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    return result.changes > 0;
  }

  private mapProject(row: Record<string, unknown>): Project {
    return {
      id: row.id as number,
      name: row.name as string,
      location: row.location as string,
      createdAt: row.created_at as string,
    };
  }
}

export class SqliteTicketRepository implements TicketRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  create(title: string, projectId?: number): Ticket {
    const stmt = this.db.prepare(
      "INSERT INTO tickets (title, project_id) VALUES (?, ?) RETURNING *"
    );
    return this.mapTicket(stmt.get(title, projectId ?? null) as Record<string, unknown>);
  }

  findAll(): Ticket[] {
    const rows = this.db.prepare("SELECT * FROM tickets ORDER BY updated_at DESC").all();
    return rows.map((r) => this.mapTicket(r as Record<string, unknown>));
  }

  findById(id: number): Ticket | undefined {
    const row = this.db.prepare("SELECT * FROM tickets WHERE id = ?").get(id);
    return row ? this.mapTicket(row as Record<string, unknown>) : undefined;
  }

  updateStage(id: number, stage: TicketStage): boolean {
    const result = this.db.prepare(
      "UPDATE tickets SET stage = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(stage, id);
    return result.changes > 0;
  }

  remove(id: number): boolean {
    const result = this.db.prepare("DELETE FROM tickets WHERE id = ?").run(id);
    return result.changes > 0;
  }

  private mapTicket(row: Record<string, unknown>): Ticket {
    return {
      id: row.id as number,
      title: row.title as string,
      stage: row.stage as TicketStage,
      projectId: row.project_id as number | null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}

export class SqliteAgentRunRepository implements AgentRunRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  create(run: Omit<AgentRun, "id" | "startedAt" | "finishedAt">): AgentRun {
    const id = randomUUID();
    const stmt = this.db.prepare(
      "INSERT INTO agent_runs (id, agent, prompt, cwd, model, status) VALUES (?, ?, ?, ?, ?, ?) RETURNING *"
    );
    return this.mapRun(stmt.get(id, run.agent, run.prompt, run.cwd, run.model, run.status) as Record<string, unknown>);
  }

  findAll(limit = 50): AgentRun[] {
    const rows = this.db.prepare("SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT ?").all(limit);
    return rows.map((r) => this.mapRun(r as Record<string, unknown>));
  }

  findById(id: string): AgentRun | undefined {
    const row = this.db.prepare("SELECT * FROM agent_runs WHERE id = ?").get(id);
    return row ? this.mapRun(row as Record<string, unknown>) : undefined;
  }

  updateStatus(id: string, status: AgentRun["status"], exitCode?: number): boolean {
    const result = this.db.prepare(
      "UPDATE agent_runs SET status = ?, exit_code = ?, finished_at = datetime('now') WHERE id = ?"
    ).run(status, exitCode ?? null, id);
    return result.changes > 0;
  }

  private mapRun(row: Record<string, unknown>): AgentRun {
    return {
      id: row.id as string,
      agent: row.agent as string,
      prompt: row.prompt as string,
      cwd: row.cwd as string,
      model: row.model as string | null,
      status: row.status as AgentRun["status"],
      exitCode: row.exit_code as number | null,
      startedAt: row.started_at as string,
      finishedAt: row.finished_at as string | null,
    };
  }
}

export class SqliteAgentDefinitionRepository implements AgentDefinitionRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  create(agent: Omit<AgentDefinition, 'isPrimary'>): AgentDefinition {
    const stmt = this.db.prepare(
      "INSERT INTO agent_definitions (id, name, command, default_args, model) VALUES (?, ?, ?, ?, ?) RETURNING *"
    );
    return this.mapAgentDefinition(
      stmt.get(agent.id, agent.name, agent.command, JSON.stringify(agent.defaultArgs), agent.model) as Record<string, unknown>
    );
  }

  findAll(): AgentDefinition[] {
    const rows = this.db.prepare("SELECT * FROM agent_definitions ORDER BY is_primary DESC, name ASC").all();
    return rows.map((r) => this.mapAgentDefinition(r as Record<string, unknown>));
  }

  findById(id: string): AgentDefinition | undefined {
    const row = this.db.prepare("SELECT * FROM agent_definitions WHERE id = ?").get(id);
    return row ? this.mapAgentDefinition(row as Record<string, unknown>) : undefined;
  }

  findPrimary(): AgentDefinition | undefined {
    const row = this.db.prepare("SELECT * FROM agent_definitions WHERE is_primary = 1").get();
    return row ? this.mapAgentDefinition(row as Record<string, unknown>) : undefined;
  }

  update(id: string, updates: Partial<Omit<AgentDefinition, 'id'>>): boolean {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      fields.push("name = ?");
      values.push(updates.name);
    }
    if (updates.command !== undefined) {
      fields.push("command = ?");
      values.push(updates.command);
    }
    if (updates.defaultArgs !== undefined) {
      fields.push("default_args = ?");
      values.push(JSON.stringify(updates.defaultArgs));
    }
    if (updates.model !== undefined) {
      fields.push("model = ?");
      values.push(updates.model);
    }

    if (fields.length === 0) return false;

    values.push(id);
    const sql = `UPDATE agent_definitions SET ${fields.join(", ")} WHERE id = ?`;
    const result = this.db.prepare(sql).run(...values);
    return result.changes > 0;
  }

  setPrimary(id: string): boolean {
    const transaction = this.db.transaction(() => {
      // Check if agent exists first
      const exists = this.db.prepare("SELECT 1 FROM agent_definitions WHERE id = ?").get(id);
      if (!exists) return false;
      
      // Clear all primary flags
      this.db.prepare("UPDATE agent_definitions SET is_primary = 0").run();
      
      // Set new primary
      const result = this.db.prepare("UPDATE agent_definitions SET is_primary = 1 WHERE id = ?").run(id);
      return result.changes > 0;
    });

    return transaction();
  }

  remove(id: string): boolean {
    const result = this.db.prepare("DELETE FROM agent_definitions WHERE id = ?").run(id);
    return result.changes > 0;
  }

  private mapAgentDefinition(row: Record<string, unknown>): AgentDefinition {
    return {
      id: row.id as string,
      name: row.name as string,
      command: row.command as string,
      defaultArgs: JSON.parse(row.default_args as string) as string[],
      model: row.model as string | null,
      isPrimary: Boolean(row.is_primary),
    };
  }
}

export class SqliteSkillRepository implements SkillRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  create(skill: Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>): Skill {
    const id = randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO skills (id, name, description, file_name, content) 
      VALUES (?, ?, ?, ?, ?) 
      RETURNING *
    `);
    return this.mapSkill(
      stmt.get(id, skill.name, skill.description, skill.fileName, skill.content) as Record<string, unknown>
    );
  }

  findAll(): Skill[] {
    const rows = this.db.prepare("SELECT * FROM skills ORDER BY name ASC").all();
    return rows.map((r) => this.mapSkill(r as Record<string, unknown>));
  }

  findById(id: string): Skill | undefined {
    const row = this.db.prepare("SELECT * FROM skills WHERE id = ?").get(id);
    return row ? this.mapSkill(row as Record<string, unknown>) : undefined;
  }

  findByFileName(fileName: string): Skill | undefined {
    const row = this.db.prepare("SELECT * FROM skills WHERE file_name = ?").get(fileName);
    return row ? this.mapSkill(row as Record<string, unknown>) : undefined;
  }

  update(id: string, updates: Partial<Omit<Skill, 'id' | 'createdAt'>>): boolean {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      fields.push("name = ?");
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      fields.push("description = ?");
      values.push(updates.description);
    }

    if (updates.fileName !== undefined) {
      fields.push("file_name = ?");
      values.push(updates.fileName);
    }

    if (updates.content !== undefined) {
      fields.push("content = ?");
      values.push(updates.content);
    }

    if (fields.length === 0) return false;

    fields.push("updated_at = datetime('now')");
    values.push(id);
    
    const sql = `UPDATE skills SET ${fields.join(", ")} WHERE id = ?`;
    const result = this.db.prepare(sql).run(...values);
    return result.changes > 0;
  }

  remove(id: string): boolean {
    const result = this.db.prepare("DELETE FROM skills WHERE id = ?").run(id);
    return result.changes > 0;
  }

  async syncFromFileSystem(skillsPath: string): Promise<void> {
    // TODO: Implement file system synchronization
    // This would scan the skills folder and sync with database
    console.log(`TODO: Sync skills from ${skillsPath}`);
  }

  private mapSkill(row: Record<string, unknown>): Skill {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      fileName: row.file_name as string,
      content: row.content as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}

export class SqliteToolRepository implements ToolRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  create(tool: Omit<Tool, 'id' | 'createdAt' | 'updatedAt'>): Tool {
    const id = randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO tools (id, name, description, file_name, content) 
      VALUES (?, ?, ?, ?, ?) 
      RETURNING *
    `);
    return this.mapTool(
      stmt.get(id, tool.name, tool.description, tool.fileName, tool.content) as Record<string, unknown>
    );
  }

  findAll(): Tool[] {
    const rows = this.db.prepare("SELECT * FROM tools ORDER BY name ASC").all();
    return rows.map((r) => this.mapTool(r as Record<string, unknown>));
  }

  findById(id: string): Tool | undefined {
    const row = this.db.prepare("SELECT * FROM tools WHERE id = ?").get(id);
    return row ? this.mapTool(row as Record<string, unknown>) : undefined;
  }

  findByFileName(fileName: string): Tool | undefined {
    const row = this.db.prepare("SELECT * FROM tools WHERE file_name = ?").get(fileName);
    return row ? this.mapTool(row as Record<string, unknown>) : undefined;
  }

  update(id: string, updates: Partial<Omit<Tool, 'id' | 'createdAt'>>): boolean {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      fields.push("name = ?");
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      fields.push("description = ?");
      values.push(updates.description);
    }

    if (updates.fileName !== undefined) {
      fields.push("file_name = ?");
      values.push(updates.fileName);
    }

    if (updates.content !== undefined) {
      fields.push("content = ?");
      values.push(updates.content);
    }

    if (fields.length === 0) return false;

    fields.push("updated_at = datetime('now')");
    values.push(id);
    
    const sql = `UPDATE tools SET ${fields.join(", ")} WHERE id = ?`;
    const result = this.db.prepare(sql).run(...values);
    return result.changes > 0;
  }

  remove(id: string): boolean {
    const result = this.db.prepare("DELETE FROM tools WHERE id = ?").run(id);
    return result.changes > 0;
  }

  async syncFromFileSystem(toolsPath: string): Promise<void> {
    // TODO: Implement file system synchronization
    // This would scan the tools folder and sync with database
    console.log(`TODO: Sync tools from ${toolsPath}`);
  }

  private mapTool(row: Record<string, unknown>): Tool {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      fileName: row.file_name as string,
      content: row.content as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}

export class SqliteTicketActivityRepository implements TicketActivityRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  create(activity: Omit<TicketActivity, 'id' | 'timestamp'>): TicketActivity {
    const stmt = this.db.prepare(`
      INSERT INTO ticket_activity (ticket_id, session_id, action, metadata) 
      VALUES (?, ?, ?, ?) 
      RETURNING *
    `);
    return this.mapTicketActivity(
      stmt.get(activity.ticketId, activity.sessionId, activity.action, activity.metadata ?? null) as Record<string, unknown>
    );
  }

  findAll(limit = 100): TicketActivity[] {
    const rows = this.db.prepare(`
      SELECT * FROM ticket_activity 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(limit);
    return rows.map((r) => this.mapTicketActivity(r as Record<string, unknown>));
  }

  findByTicketId(ticketId: number): TicketActivity[] {
    const rows = this.db.prepare(`
      SELECT * FROM ticket_activity 
      WHERE ticket_id = ? 
      ORDER BY timestamp DESC
    `).all(ticketId);
    return rows.map((r) => this.mapTicketActivity(r as Record<string, unknown>));
  }

  findBySessionId(sessionId: string): TicketActivity[] {
    const rows = this.db.prepare(`
      SELECT * FROM ticket_activity 
      WHERE session_id = ? 
      ORDER BY timestamp DESC
    `).all(sessionId);
    return rows.map((r) => this.mapTicketActivity(r as Record<string, unknown>));
  }

  findByDateRange(startDate: string, endDate: string): TicketActivity[] {
    const rows = this.db.prepare(`
      SELECT * FROM ticket_activity 
      WHERE DATE(timestamp) BETWEEN DATE(?) AND DATE(?) 
      ORDER BY timestamp DESC
    `).all(startDate, endDate);
    return rows.map((r) => this.mapTicketActivity(r as Record<string, unknown>));
  }

  private mapTicketActivity(row: Record<string, unknown>): TicketActivity {
    return {
      id: row.id as number,
      ticketId: row.ticket_id as number,
      sessionId: row.session_id as string,
      action: row.action as TicketAction,
      timestamp: row.timestamp as string,
      metadata: row.metadata === null ? undefined : (row.metadata as string),
    };
  }
}
