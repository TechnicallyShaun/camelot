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

export interface Skill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly fileName: string;
  readonly content: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Tool {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly fileName: string;
  readonly content: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SkillRepository {
  create(skill: Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>): Skill;
  findAll(): Skill[];
  findById(id: string): Skill | undefined;
  findByFileName(fileName: string): Skill | undefined;
  update(id: string, updates: Partial<Omit<Skill, 'id' | 'createdAt'>>): boolean;
  remove(id: string): boolean;
  syncFromFileSystem(skillsPath: string): Promise<void>;
}

export interface SkillPublisher {
  publishToFile(skillId: string, outputDir: string): Promise<string>;
  publishAllToDirectory(outputDir: string): Promise<string[]>;
}

export interface SdpPlan {
  readonly name: string;
  readonly description?: string;
  readonly tasks: SdpTask[];
  readonly filePath: string;
  readonly lastModified: Date;
}

export interface SdpTask {
  readonly title: string;
  readonly description?: string;
  readonly completed?: boolean;
  readonly dependencies?: string[];
}

export interface SdpPlanReader {
  scanDirectory(sdpPlansPath: string): Promise<SdpPlan[]>;
  readPlanFile(filePath: string): Promise<SdpPlan | null>;
  syncPlansToTickets(plans: SdpPlan[], projectId?: number): Promise<SyncResult>;
}

export interface SyncResult {
  readonly created: number;
  readonly updated: number;
  readonly errors: string[];
}

export interface ToolRepository {
  create(tool: Omit<Tool, 'id' | 'createdAt' | 'updatedAt'>): Tool;
  findAll(): Tool[];
  findById(id: string): Tool | undefined;
  findByFileName(fileName: string): Tool | undefined;
  update(id: string, updates: Partial<Omit<Tool, 'id' | 'createdAt'>>): boolean;
  remove(id: string): boolean;
  syncFromFileSystem(toolsPath: string): Promise<void>;
}
