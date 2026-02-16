export interface Database {
  initialize(): void;
  close(): void;
  readonly db: unknown;
}

export interface Project {
  readonly id: number;
  readonly name: string;
  readonly location: string;
  readonly createdAt: string;
}

export interface Ticket {
  readonly id: number;
  readonly title: string;
  readonly stage: TicketStage;
  readonly projectId: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type TicketStage =
  | "inbox"
  | "cleansing"
  | "planning"
  | "development"
  | "review"
  | "done";

export interface AgentRun {
  readonly id: string;
  readonly agent: string;
  readonly prompt: string;
  readonly cwd: string;
  readonly model: string | null;
  readonly status: "running" | "completed" | "failed";
  readonly exitCode: number | null;
  readonly startedAt: string;
  readonly finishedAt: string | null;
}

export interface ProjectRepository {
  create(name: string, location: string): Project;
  findAll(): Project[];
  findById(id: number): Project | undefined;
  remove(id: number): boolean;
}

export interface TicketRepository {
  create(title: string, projectId?: number): Ticket;
  findAll(): Ticket[];
  findById(id: number): Ticket | undefined;
  updateStage(id: number, stage: TicketStage): boolean;
  remove(id: number): boolean;
}

export interface AgentRunRepository {
  create(run: Omit<AgentRun, "id" | "startedAt" | "finishedAt">): AgentRun;
  findAll(limit?: number): AgentRun[];
  findById(id: string): AgentRun | undefined;
  updateStatus(id: string, status: AgentRun["status"], exitCode?: number): boolean;
}

export interface AgentDefinition {
  readonly id: string;
  readonly name: string;
  readonly command: string;
  readonly defaultArgs: string[];
  readonly model: string | null;
  readonly isPrimary: boolean;
}

export interface AgentDefinitionRepository {
  create(agent: Omit<AgentDefinition, 'isPrimary'>): AgentDefinition;
  findAll(): AgentDefinition[];
  findById(id: string): AgentDefinition | undefined;
  findPrimary(): AgentDefinition | undefined;
  update(id: string, updates: Partial<Omit<AgentDefinition, 'id'>>): boolean;
  setPrimary(id: string): boolean;
  remove(id: string): boolean;
}
