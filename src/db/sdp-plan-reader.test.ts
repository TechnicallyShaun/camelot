import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readdir, readFile, stat } from 'node:fs/promises';
import { FileSystemSdpPlanReader } from './sdp-plan-reader.js';
import type { TicketRepository, Ticket } from './types.js';
import type { Logger } from '../logger.js';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
}));

const mockReaddir = vi.mocked(readdir);
const mockReadFile = vi.mocked(readFile);
const mockStat = vi.mocked(stat);

describe('FileSystemSdpPlanReader', () => {
  let mockTicketRepo: TicketRepository;
  let mockLogger: Logger;
  let reader: FileSystemSdpPlanReader;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTicketRepo = {
      create: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn(),
      updateStage: vi.fn(),
      remove: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(() => mockLogger),
    };

    reader = new FileSystemSdpPlanReader(mockTicketRepo, mockLogger);
  });

  describe('scanDirectory', () => {
    it('should find and parse SDP plan files', async () => {
      // Mock directory structure: /root/.sdp/plans/feature.md
      mockReaddir.mockResolvedValueOnce([
        { name: '.sdp', isDirectory: () => true } as any,
        { name: 'other', isDirectory: () => true } as any,
      ]);

      mockStat.mockResolvedValueOnce({ isDirectory: () => true } as any);
      mockReaddir.mockResolvedValueOnce(['feature.md', 'bug-fix.txt']);

      const planContent = `# Feature Development

This is a plan for developing a new feature.

- [ ] Design the feature
- [x] Implement core logic
- [ ] Add tests
  - Unit tests
  - Integration tests
- [x] Deploy to staging ✅`;

      mockReadFile.mockResolvedValue(planContent);
      mockStat.mockResolvedValue({ mtime: new Date('2024-01-15') } as any);

      const plans = await reader.scanDirectory('/root');

      expect(plans).toHaveLength(2); // feature.md and bug-fix.txt
      expect(plans[0]).toEqual({
        name: 'Feature Development',
        description: 'This is a plan for developing a new feature.',
        tasks: [
          { title: 'Design the feature', completed: false, dependencies: [] },
          { title: 'Implement core logic', completed: true, dependencies: [] },
          { 
            title: 'Add tests', 
            completed: false,
            description: 'Unit tests\nIntegration tests',
            dependencies: []
          },
          { title: 'Deploy to staging', completed: true, dependencies: [] },
        ],
        filePath: '/root/.sdp/plans/feature.md',
        lastModified: new Date('2024-01-15'),
      });
    });

    it('should handle empty directories gracefully', async () => {
      mockReaddir.mockResolvedValueOnce([]);

      const plans = await reader.scanDirectory('/empty');

      expect(plans).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { count: 0, sdpPlansPath: '/empty' },
        'Scanned SDP plans directory'
      );
    });

    it('should handle read errors gracefully', async () => {
      mockReaddir.mockRejectedValueOnce(new Error('Permission denied'));

      const plans = await reader.scanDirectory('/forbidden');

      expect(plans).toHaveLength(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Failed to scan SDP plans directory'
      );
    });
  });

  describe('readPlanFile', () => {
    it('should parse simple plan with tasks', async () => {
      const content = `# Simple Plan
      
- [ ] First task
- [x] Completed task
- [ ] Third task`;

      mockReadFile.mockResolvedValue(content);
      mockStat.mockResolvedValue({ mtime: new Date('2024-01-01') } as any);

      const plan = await reader.readPlanFile('/path/to/simple.md');

      expect(plan).toEqual({
        name: 'Simple Plan',
        description: undefined,
        tasks: [
          { title: 'First task', completed: false, dependencies: [] },
          { title: 'Completed task', completed: true, dependencies: [] },
          { title: 'Third task', completed: false, dependencies: [] },
        ],
        filePath: '/path/to/simple.md',
        lastModified: new Date('2024-01-01'),
      });
    });

    it('should handle file read errors', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'));

      const plan = await reader.readPlanFile('/nonexistent.md');

      expect(plan).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Failed to read SDP plan file'
      );
    });

    it('should parse plan with different task markers', async () => {
      const content = `# Mixed Markers

* [ ] Asterisk unchecked
+ [X] Plus checked
- [ ] Dash unchecked
* [x] Asterisk checked`;

      mockReadFile.mockResolvedValue(content);
      mockStat.mockResolvedValue({ mtime: new Date() } as any);

      const plan = await reader.readPlanFile('/mixed.md');

      expect(plan?.tasks).toEqual([
        { title: 'Asterisk unchecked', completed: false, dependencies: [] },
        { title: 'Plus checked', completed: true, dependencies: [] },
        { title: 'Dash unchecked', completed: false, dependencies: [] },
        { title: 'Asterisk checked', completed: true, dependencies: [] },
      ]);
    });

    it('should handle emoji completion markers', async () => {
      const content = `# Emoji Plan

- [ ] Pending task
- [x] Completed with checkbox ✅
- [ ] Another pending ✅`;

      mockReadFile.mockResolvedValue(content);
      mockStat.mockResolvedValue({ mtime: new Date() } as any);

      const plan = await reader.readPlanFile('/emoji.md');

      expect(plan?.tasks).toEqual([
        { title: 'Pending task', completed: false, dependencies: [] },
        { title: 'Completed with checkbox', completed: true, dependencies: [] },
        { title: 'Another pending', completed: true, dependencies: [] },
      ]);
    });
  });

  describe('syncPlansToTickets', () => {
    it('should create new tickets for tasks', async () => {
      const plans = [{
        name: 'Test Plan',
        tasks: [
          { title: 'New Task 1', completed: false, dependencies: [] },
          { title: 'New Task 2', completed: true, dependencies: [] },
        ],
        filePath: '/test.md',
        lastModified: new Date(),
      }];

      mockTicketRepo.findAll = vi.fn().mockReturnValue([]);
      mockTicketRepo.create = vi.fn()
        .mockReturnValueOnce({ id: 1, title: 'New Task 1', stage: 'planning' })
        .mockReturnValueOnce({ id: 2, title: 'New Task 2', stage: 'done' });

      const result = await reader.syncPlansToTickets(plans, 123);

      expect(result.created).toBe(2);
      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockTicketRepo.create).toHaveBeenCalledWith('New Task 1', 123);
      expect(mockTicketRepo.create).toHaveBeenCalledWith('New Task 2', 123);
    });

    it('should update existing tickets stage based on completion', async () => {
      const existingTickets: Ticket[] = [
        { id: 1, title: 'Existing Task', stage: 'development', projectId: null, createdAt: '', updatedAt: '' },
      ];

      const plans = [{
        name: 'Test Plan',
        tasks: [
          { title: 'Existing Task', completed: true, dependencies: [] },
        ],
        filePath: '/test.md',
        lastModified: new Date(),
      }];

      mockTicketRepo.findAll = vi.fn().mockReturnValue(existingTickets);
      mockTicketRepo.updateStage = vi.fn().mockReturnValue(true);

      const result = await reader.syncPlansToTickets(plans);

      expect(result.created).toBe(0);
      expect(result.updated).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockTicketRepo.updateStage).toHaveBeenCalledWith(1, 'done');
    });

    it('should not update tickets if stage is already correct', async () => {
      const existingTickets: Ticket[] = [
        { id: 1, title: 'Already Done', stage: 'done', projectId: null, createdAt: '', updatedAt: '' },
      ];

      const plans = [{
        name: 'Test Plan',
        tasks: [
          { title: 'Already Done', completed: true, dependencies: [] },
        ],
        filePath: '/test.md',
        lastModified: new Date(),
      }];

      mockTicketRepo.findAll = vi.fn().mockReturnValue(existingTickets);

      const result = await reader.syncPlansToTickets(plans);

      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockTicketRepo.updateStage).not.toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      const plans = [{
        name: 'Error Plan',
        tasks: [
          { title: 'Task that fails', completed: false, dependencies: [] },
        ],
        filePath: '/error.md',
        lastModified: new Date(),
      }];

      mockTicketRepo.findAll = vi.fn().mockReturnValue([]);
      mockTicketRepo.create = vi.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await reader.syncPlansToTickets(plans);

      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to sync plan Error Plan');
    });
  });
});