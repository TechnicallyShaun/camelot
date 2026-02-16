import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileSystemSkillPublisher } from './skill-publisher.js';
import type { SkillRepository, Skill } from './types.js';
import type { Logger } from '../logger.js';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
}));

const mockMkdir = vi.mocked(mkdir);
const mockWriteFile = vi.mocked(writeFile);

describe('FileSystemSkillPublisher', () => {
  let mockSkillRepo: SkillRepository;
  let mockLogger: Logger;
  let publisher: FileSystemSkillPublisher;

  const sampleSkill: Skill = {
    id: 'test-skill-1',
    name: 'Test Skill',
    description: 'A test skill for demonstration',
    fileName: 'test-skill',
    content: '#!/bin/bash\necho "Hello from test skill"',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSkillRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      findByFileName: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      syncFromFileSystem: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(() => mockLogger),
    };

    publisher = new FileSystemSkillPublisher(mockSkillRepo, mockLogger);
  });

  describe('publishToFile', () => {
    it('should publish skill to markdown file', async () => {
      const outputDir = '/tmp/skills';
      mockSkillRepo.findById = vi.fn().mockReturnValue(sampleSkill);

      const result = await publisher.publishToFile('test-skill-1', outputDir);

      expect(mockMkdir).toHaveBeenCalledWith(outputDir, { recursive: true });
      expect(mockWriteFile).toHaveBeenCalledWith(
        join(outputDir, 'test-skill.md'),
        expect.stringContaining('# Test Skill'),
        'utf-8'
      );
      expect(result).toBe(join(outputDir, 'test-skill.md'));
      expect(mockLogger.info).toHaveBeenCalledWith(
        { skillId: 'test-skill-1', filePath: join(outputDir, 'test-skill.md') },
        'Published skill to filesystem'
      );
    });

    it('should add .md extension if not present', async () => {
      const skillWithoutExtension = { ...sampleSkill, fileName: 'no-extension' };
      mockSkillRepo.findById = vi.fn().mockReturnValue(skillWithoutExtension);

      await publisher.publishToFile('test-skill-1', '/tmp/skills');

      expect(mockWriteFile).toHaveBeenCalledWith(
        join('/tmp/skills', 'no-extension.md'),
        expect.any(String),
        'utf-8'
      );
    });

    it('should not duplicate .md extension if already present', async () => {
      const skillWithMdExtension = { ...sampleSkill, fileName: 'already.md' };
      mockSkillRepo.findById = vi.fn().mockReturnValue(skillWithMdExtension);

      await publisher.publishToFile('test-skill-1', '/tmp/skills');

      expect(mockWriteFile).toHaveBeenCalledWith(
        join('/tmp/skills', 'already.md'),
        expect.any(String),
        'utf-8'
      );
    });

    it('should throw error if skill not found', async () => {
      mockSkillRepo.findById = vi.fn().mockReturnValue(undefined);

      await expect(publisher.publishToFile('nonexistent', '/tmp/skills'))
        .rejects.toThrow('Skill with ID nonexistent not found');
    });

    it('should format skill content as markdown correctly', async () => {
      mockSkillRepo.findById = vi.fn().mockReturnValue(sampleSkill);

      await publisher.publishToFile('test-skill-1', '/tmp/skills');

      const expectedContent = `# Test Skill

> **File:** test-skill

A test skill for demonstration

## Content

#!/bin/bash
echo "Hello from test skill"
`;

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.any(String),
        expectedContent,
        'utf-8'
      );
    });
  });

  describe('publishAllToDirectory', () => {
    const skill2: Skill = {
      id: 'test-skill-2',
      name: 'Another Skill',
      description: 'Another test skill',
      fileName: 'another-skill.md',
      content: 'Some content here',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('should publish all skills to directory', async () => {
      mockSkillRepo.findAll = vi.fn().mockReturnValue([sampleSkill, skill2]);
      mockSkillRepo.findById = vi.fn()
        .mockReturnValueOnce(sampleSkill)
        .mockReturnValueOnce(skill2);

      const result = await publisher.publishAllToDirectory('/tmp/all-skills');

      expect(mockMkdir).toHaveBeenCalledWith('/tmp/all-skills', { recursive: true });
      expect(mockWriteFile).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result).toContain(join('/tmp/all-skills', 'test-skill.md'));
      expect(result).toContain(join('/tmp/all-skills', 'another-skill.md'));
    });

    it('should continue publishing other skills if one fails', async () => {
      mockSkillRepo.findAll = vi.fn().mockReturnValue([sampleSkill, skill2]);
      mockSkillRepo.findById = vi.fn()
        .mockReturnValueOnce(sampleSkill)
        .mockReturnValueOnce(undefined); // skill2 not found

      const result = await publisher.publishAllToDirectory('/tmp/all-skills');

      expect(result).toHaveLength(1);
      expect(result).toContain(join('/tmp/all-skills', 'test-skill.md'));
      expect(mockLogger.error).toHaveBeenCalledWith(
        { skillId: 'test-skill-2', error: expect.any(Error) },
        'Failed to publish skill'
      );
    });

    it('should log successful batch publication', async () => {
      mockSkillRepo.findAll = vi.fn().mockReturnValue([sampleSkill]);
      mockSkillRepo.findById = vi.fn().mockReturnValue(sampleSkill);

      await publisher.publishAllToDirectory('/tmp/all-skills');

      expect(mockLogger.info).toHaveBeenCalledWith(
        { count: 1, outputDir: '/tmp/all-skills' },
        'Published all skills to directory'
      );
    });
  });
});