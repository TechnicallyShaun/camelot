import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SkillPublisher, SkillRepository } from "./types.js";
import type { Logger } from "../logger.js";

export class FileSystemSkillPublisher implements SkillPublisher {
  constructor(
    private readonly skills: SkillRepository,
    private readonly logger: Logger
  ) {}

  async publishToFile(skillId: string, outputDir: string): Promise<string> {
    const skill = this.skills.findById(skillId);
    if (!skill) {
      throw new Error(`Skill with ID ${skillId} not found`);
    }

    // Ensure output directory exists
    await mkdir(outputDir, { recursive: true });

    // Create markdown filename from skill fileName (ensure .md extension)
    const fileName = skill.fileName.endsWith('.md') ? skill.fileName : `${skill.fileName}.md`;
    const filePath = join(outputDir, fileName);

    // Format skill content as markdown
    const markdownContent = this.formatSkillAsMarkdown(skill);

    // Write to file
    await writeFile(filePath, markdownContent, 'utf-8');
    
    this.logger.info({ skillId, filePath }, "Published skill to filesystem");
    return filePath;
  }

  async publishAllToDirectory(outputDir: string): Promise<string[]> {
    const allSkills = this.skills.findAll();
    const publishedPaths: string[] = [];

    // Ensure output directory exists
    await mkdir(outputDir, { recursive: true });

    for (const skill of allSkills) {
      try {
        const filePath = await this.publishToFile(skill.id, outputDir);
        publishedPaths.push(filePath);
      } catch (error) {
        this.logger.error({ skillId: skill.id, error }, "Failed to publish skill");
        // Continue with other skills even if one fails
      }
    }

    this.logger.info({ count: publishedPaths.length, outputDir }, "Published all skills to directory");
    return publishedPaths;
  }

  private formatSkillAsMarkdown(skill: { name: string; description: string; content: string; fileName: string }): string {
    return `# ${skill.name}

> **File:** ${skill.fileName}

${skill.description}

## Content

${skill.content}
`;
  }
}