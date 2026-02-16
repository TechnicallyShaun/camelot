import { readdir, readFile, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import type { SdpPlanReader, SdpPlan, SdpTask, TicketRepository, SyncResult } from "./types.js";
import type { Logger } from "../logger.js";

export class FileSystemSdpPlanReader implements SdpPlanReader {
  constructor(
    private readonly tickets: TicketRepository,
    private readonly logger: Logger
  ) {}

  async scanDirectory(sdpPlansPath: string): Promise<SdpPlan[]> {
    try {
      const planDirs = await this.findPlanDirectories(sdpPlansPath);
      const plans: SdpPlan[] = [];

      for (const planDir of planDirs) {
        const plansSubDir = join(planDir, 'plans');
        try {
          const stats = await stat(plansSubDir);
          if (stats.isDirectory()) {
            const planFiles = await this.findPlanFiles(plansSubDir);
            for (const planFile of planFiles) {
              const plan = await this.readPlanFile(planFile);
              if (plan) {
                plans.push(plan);
              }
            }
          }
        } catch (error) {
          // Skip directories without plans subdirectory
          this.logger.debug({ planDir, error }, "No plans directory found or error reading");
        }
      }

      this.logger.info({ count: plans.length, sdpPlansPath }, "Scanned SDP plans directory");
      return plans;
    } catch (error) {
      this.logger.error({ error, sdpPlansPath }, "Failed to scan SDP plans directory");
      return [];
    }
  }

  async readPlanFile(filePath: string): Promise<SdpPlan | null> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const stats = await stat(filePath);
      
      const plan = this.parsePlanContent(content, filePath, stats.mtime);
      this.logger.debug({ filePath, taskCount: plan.tasks.length }, "Parsed SDP plan file");
      
      return plan;
    } catch (error) {
      this.logger.error({ error, filePath }, "Failed to read SDP plan file");
      return null;
    }
  }

  async syncPlansToTickets(plans: SdpPlan[], projectId?: number): Promise<SyncResult> {
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const plan of plans) {
      try {
        for (const task of plan.tasks) {
          // Check if ticket already exists (simple heuristic: same title)
          const existingTickets = this.tickets.findAll();
          const existing = existingTickets.find(t => t.title === task.title);

          if (existing) {
            // Update stage based on task completion
            const targetStage = task.completed ? 'done' : 'planning';
            if (existing.stage !== targetStage) {
              this.tickets.updateStage(existing.id, targetStage);
              updated++;
              this.logger.debug({ ticketId: existing.id, stage: targetStage }, "Updated ticket stage from SDP plan");
            }
          } else {
            // Create new ticket
            const stage = task.completed ? 'done' : 'planning';
            this.tickets.create(task.title, projectId);
            created++;
            this.logger.debug({ title: task.title, stage }, "Created ticket from SDP plan");
          }
        }
      } catch (error) {
        const errorMsg = `Failed to sync plan ${plan.name}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        this.logger.error({ error, planName: plan.name }, "Failed to sync SDP plan to tickets");
      }
    }

    this.logger.info({ created, updated, errors: errors.length }, "Completed SDP plans sync");
    return { created, updated, errors };
  }

  private async findPlanDirectories(rootPath: string): Promise<string[]> {
    const entries = await readdir(rootPath, { withFileTypes: true });
    const planDirs: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('.sdp')) {
        planDirs.push(join(rootPath, entry.name));
      }
    }

    return planDirs;
  }

  private async findPlanFiles(plansDir: string): Promise<string[]> {
    try {
      const entries = await readdir(plansDir);
      const planFiles: string[] = [];

      for (const entry of entries) {
        if (entry.endsWith('.md') || entry.endsWith('.txt') || entry.endsWith('.plan')) {
          planFiles.push(join(plansDir, entry));
        }
      }

      return planFiles;
    } catch (error) {
      this.logger.debug({ error, plansDir }, "Could not read plans directory");
      return [];
    }
  }

  private parsePlanContent(content: string, filePath: string, lastModified: Date): SdpPlan {
    const lines = content.split('\n');
    const tasks: SdpTask[] = [];
    
    let name = basename(filePath, '.md').replace(/\.[^.]*$/, ''); // Remove any extension
    let description = '';
    let foundTitle = false;
    
    let inTaskSection = false;
    let currentTask: Partial<SdpTask> = {};
    
    for (let i = 0; i < lines.length; i++) {
      const originalLine = lines[i];  // Keep original with indentation
      const line = originalLine.trim();
      
      // Skip empty lines
      if (!line) continue;
      
      // Extract plan name from first heading
      if (line.startsWith('# ') && !foundTitle) {
        name = line.substring(2).trim();
        foundTitle = true;
        continue;
      }
      
      // Extract description from content before tasks
      if (!inTaskSection && line && !line.startsWith('#') && !originalLine.match(/^\s*[-*+]\s+/)) {
        description += (description ? ' ' : '') + line;
        continue;
      }
      
      // Check if this is an indented sub-item (at least 2 spaces before bullet)
      const indentedMatch = originalLine.match(/^(\s{2,})[-*+]?\s*(.+)$/);
      if (inTaskSection && currentTask.title && indentedMatch) {
        const subItem = indentedMatch[2].trim();
        if (subItem) {
          const existingDesc = (currentTask as any).description;
          (currentTask as any).description = existingDesc 
            ? `${existingDesc}\n${subItem}` 
            : subItem;
        }
        continue;
      }
      
      // Check if this is a main task (starts at beginning of line)
      const mainTaskMatch = originalLine.match(/^[-*+]\s+(.+)$/);
      if (mainTaskMatch) {
        // Save previous task if exists
        if (currentTask.title) {
          tasks.push(this.completeTask(currentTask));
        }
        
        inTaskSection = true;
        const taskText = mainTaskMatch[1].trim();
        
        // Check for completed task markers
        const isCompleted = taskText.startsWith('[x]') || taskText.startsWith('[X]') || taskText.includes('✅');
        const title = taskText
          .replace(/^\[[ xX]\]\s*/, '') // Remove checkbox markers
          .replace(/✅/g, '') // Remove checkmark emoji
          .trim();
          
        currentTask = {
          title,
          completed: isCompleted,
          dependencies: []
        };
        continue;
      }
      
      // Break task parsing on new section
      if (line.startsWith('#') && inTaskSection) {
        if (currentTask.title) {
          tasks.push(this.completeTask(currentTask));
          currentTask = {};
        }
        inTaskSection = false;
      }
    }
    
    // Save final task if exists
    if (currentTask.title) {
      tasks.push(this.completeTask(currentTask));
    }
    
    return {
      name,
      description: description.trim() || undefined,
      tasks,
      filePath,
      lastModified
    };
  }
  
  private completeTask(task: Partial<SdpTask>): SdpTask {
    return {
      title: task.title!,
      description: task.description && task.description.trim() ? task.description.trim() : undefined,
      completed: task.completed || false,
      dependencies: task.dependencies || []
    };
  }
}