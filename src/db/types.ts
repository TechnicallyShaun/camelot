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

export type TicketStage = "open" | "closed";

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
  updateProject(id: number, projectId: number | null): boolean;
  update(id: number, updates: { title?: string; stage?: TicketStage; projectId?: number | null }): boolean;
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

export interface TicketActivity {
  readonly id: number;
  readonly ticketId: number;
  readonly sessionId: string;
  readonly action: TicketAction;
  readonly timestamp: string;
  readonly metadata?: string; // JSON string for additional context
}

export type TicketAction = "viewed" | "created" | "updated" | "deleted" | "stage_changed" | "resolved";

export interface TicketActivityRepository {
  create(activity: Omit<TicketActivity, 'id' | 'timestamp'>): TicketActivity;
  findAll(limit?: number): TicketActivity[];
  findByTicketId(ticketId: number): TicketActivity[];
  findBySessionId(sessionId: string): TicketActivity[];
  findByDateRange(startDate: string, endDate: string): TicketActivity[];
}

export interface DailySummary {
  readonly date: string; // YYYY-MM-DD
  readonly tickets: {
    readonly created: number;
    readonly updated: number;
    readonly completed: number;
    readonly deleted: number;
  };
  readonly sessions: {
    readonly total: number;
    readonly unique: string[];
  };
  readonly activities: {
    readonly total: number;
    readonly byAction: Record<TicketAction, number>;
  };
  readonly effortBullets: string[];
}

export interface DailySummaryGenerator {
  generateSummary(date: string): Promise<DailySummary>;
}

export interface DailySummaryExporter {
  exportToFile(date: string, outputDir: string): Promise<string>;
}

export interface Service {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly provider: string;
  readonly baseUrl: string;
  readonly authType: 'none' | 'api_key' | 'oauth' | 'bearer';
  readonly status: 'active' | 'inactive';
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ServiceRepository {
  create(service: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>): Service;
  findAll(): Service[];
  findById(id: string): Service | undefined;
  update(id: string, updates: Partial<Omit<Service, 'id' | 'createdAt'>>): boolean;
  remove(id: string): boolean;
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
