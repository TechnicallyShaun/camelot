import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FileSystemDailySummaryExporter } from './daily-summary-exporter.js';
import type { DailySummaryGenerator, DailySummary } from './types.js';
import type { Logger } from '../logger.js';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

const mockMkdir = vi.mocked(mkdir);
const mockWriteFile = vi.mocked(writeFile);

describe('FileSystemDailySummaryExporter', () => {
  let mockSummaryGenerator: DailySummaryGenerator;
  let mockLogger: Logger;
  let exporter: FileSystemDailySummaryExporter;

  const testDate = '2024-01-15';
  const testSummary: DailySummary = {
    date: testDate,
    tickets: {
      created: 3,
      updated: 2,
      completed: 1,
      deleted: 0,
    },
    sessions: {
      total: 2,
      unique: ['session-1', 'session-2'],
    },
    activities: {
      total: 12,
      byAction: {
        viewed: 5,
        created: 3,
        updated: 2,
        deleted: 0,
        stage_changed: 2,
      },
    },
    effortBullets: [
      '• Created 3 new tickets',
      '• Updated 2 tickets',
      '• Completed 1 ticket',
      '• Active in 2 sessions',
      '• Moderate activity: 12 total actions',
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSummaryGenerator = {
      generateSummary: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(() => mockLogger),
    };

    exporter = new FileSystemDailySummaryExporter(mockSummaryGenerator, mockLogger);
  });

  it('exports daily summary to markdown file', async () => {
    const outputDir = '/tmp/summaries';
    mockSummaryGenerator.generateSummary = vi.fn().mockResolvedValue(testSummary);

    const result = await exporter.exportToFile(testDate, outputDir);

    expect(mockMkdir).toHaveBeenCalledWith(outputDir, { recursive: true });
    expect(mockSummaryGenerator.generateSummary).toHaveBeenCalledWith(testDate);
    
    expect(result).toBe(join(outputDir, `daily-summary-${testDate}.md`));
    
    expect(mockWriteFile).toHaveBeenCalledWith(
      join(outputDir, `daily-summary-${testDate}.md`),
      expect.stringContaining('# Daily Summary - Monday, January 15, 2024'),
      'utf-8'
    );

    expect(mockLogger.info).toHaveBeenCalledWith(
      { date: testDate, filePath: result },
      'Exported daily summary to file'
    );
  });

  it('formats summary with correct markdown structure', async () => {
    mockSummaryGenerator.generateSummary = vi.fn().mockResolvedValue(testSummary);

    await exporter.exportToFile(testDate, '/tmp');

    const capturedContent = mockWriteFile.mock.calls[0][1] as string;

    // Check main structure
    expect(capturedContent).toContain('# Daily Summary - Monday, January 15, 2024');
    expect(capturedContent).toContain('## 📊 Activity Overview');
    expect(capturedContent).toContain('## 🎯 Effort Summary');
    expect(capturedContent).toContain('## 📈 Productivity Insights');

    // Check ticket data
    expect(capturedContent).toContain('**Created:** 3');
    expect(capturedContent).toContain('**Updated:** 2');
    expect(capturedContent).toContain('**Completed:** 1');
    expect(capturedContent).toContain('**Deleted:** 0');

    // Check session data
    expect(capturedContent).toContain('**Total Sessions:** 2');
    expect(capturedContent).toContain('session-1, session-2');

    // Check activity data
    expect(capturedContent).toContain('**Total Actions:** 12');
    expect(capturedContent).toContain('Viewed: 5');
    expect(capturedContent).toContain('Created: 3');
    expect(capturedContent).toContain('Stage Changed: 2');

    // Check effort bullets
    expect(capturedContent).toContain('• Created 3 new tickets');
    expect(capturedContent).toContain('• Updated 2 tickets');
    expect(capturedContent).toContain('• Active in 2 sessions');
  });

  it('generates productivity insights for high activity', async () => {
    const highActivitySummary: DailySummary = {
      ...testSummary,
      tickets: { created: 8, updated: 5, completed: 3, deleted: 1 },
      activities: { ...testSummary.activities, total: 35 },
    };

    mockSummaryGenerator.generateSummary = vi.fn().mockResolvedValue(highActivitySummary);

    await exporter.exportToFile(testDate, '/tmp');

    const capturedContent = mockWriteFile.mock.calls[0][1] as string;
    expect(capturedContent).toContain('🔥 **High productivity day**');
  });

  it('generates insights for focused single session', async () => {
    const singleSessionSummary: DailySummary = {
      ...testSummary,
      sessions: { total: 1, unique: ['session-1'] },
    };

    mockSummaryGenerator.generateSummary = vi.fn().mockResolvedValue(singleSessionSummary);

    await exporter.exportToFile(testDate, '/tmp');

    const capturedContent = mockWriteFile.mock.calls[0][1] as string;
    expect(capturedContent).toContain('🎯 **Focused session**');
  });

  it('generates insights for multi-session day', async () => {
    const multiSessionSummary: DailySummary = {
      ...testSummary,
      sessions: { total: 4, unique: ['s1', 's2', 's3', 's4'] },
    };

    mockSummaryGenerator.generateSummary = vi.fn().mockResolvedValue(multiSessionSummary);

    await exporter.exportToFile(testDate, '/tmp');

    const capturedContent = mockWriteFile.mock.calls[0][1] as string;
    expect(capturedContent).toContain('🔄 **Multi-session day**');
  });

  it('generates completion rate insights', async () => {
    const completionSummary: DailySummary = {
      ...testSummary,
      tickets: { created: 4, updated: 2, completed: 3, deleted: 0 },
    };

    mockSummaryGenerator.generateSummary = vi.fn().mockResolvedValue(completionSummary);

    await exporter.exportToFile(testDate, '/tmp');

    const capturedContent = mockWriteFile.mock.calls[0][1] as string;
    expect(capturedContent).toContain('✅ **Strong completion rate**');
    expect(capturedContent).toContain('50% of worked tickets completed');
  });

  it('handles no activity gracefully', async () => {
    const noActivitySummary: DailySummary = {
      date: testDate,
      tickets: { created: 0, updated: 0, completed: 0, deleted: 0 },
      sessions: { total: 0, unique: [] },
      activities: {
        total: 0,
        byAction: { viewed: 0, created: 0, updated: 0, deleted: 0, stage_changed: 0 },
      },
      effortBullets: ['• No activity recorded'],
    };

    mockSummaryGenerator.generateSummary = vi.fn().mockResolvedValue(noActivitySummary);

    await exporter.exportToFile(testDate, '/tmp');

    const capturedContent = mockWriteFile.mock.calls[0][1] as string;
    expect(capturedContent).toContain('😴 **Quiet day**');
    expect(capturedContent).toContain('**Active Sessions:** None');
  });

  it('ensures bullet points are properly formatted', async () => {
    const bulletTestSummary: DailySummary = {
      ...testSummary,
      effortBullets: [
        '• Already has bullet',
        'Missing bullet point',
        '• Another with bullet',
      ],
    };

    mockSummaryGenerator.generateSummary = vi.fn().mockResolvedValue(bulletTestSummary);

    await exporter.exportToFile(testDate, '/tmp');

    const capturedContent = mockWriteFile.mock.calls[0][1] as string;
    expect(capturedContent).toContain('• Already has bullet\n• Missing bullet point\n• Another with bullet');
  });

  it('handles summary generation errors', async () => {
    const error = new Error('Summary generation failed');
    mockSummaryGenerator.generateSummary = vi.fn().mockRejectedValue(error);

    await expect(exporter.exportToFile(testDate, '/tmp')).rejects.toThrow(
      'Failed to export daily summary for 2024-01-15: Summary generation failed'
    );

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error, date: testDate }),
      'Failed to export daily summary'
    );
  });

  it('handles file system errors', async () => {
    mockSummaryGenerator.generateSummary = vi.fn().mockResolvedValue(testSummary);
    mockWriteFile.mockRejectedValueOnce(new Error('Write permission denied'));

    await expect(exporter.exportToFile(testDate, '/tmp')).rejects.toThrow(
      'Failed to export daily summary for 2024-01-15: Write permission denied'
    );
  });

  it('creates output directory if it does not exist', async () => {
    const outputDir = '/nonexistent/path';
    mockSummaryGenerator.generateSummary = vi.fn().mockResolvedValue(testSummary);

    await exporter.exportToFile(testDate, outputDir);

    expect(mockMkdir).toHaveBeenCalledWith(outputDir, { recursive: true });
  });

  it('includes generation timestamp', async () => {
    const fixedDate = new Date('2024-01-15T14:30:00.000Z');
    vi.spyOn(global, 'Date').mockImplementation(() => fixedDate as any);

    mockSummaryGenerator.generateSummary = vi.fn().mockResolvedValue(testSummary);

    await exporter.exportToFile(testDate, '/tmp');

    const capturedContent = mockWriteFile.mock.calls[0][1] as string;
    expect(capturedContent).toContain('**Generated on:** 2024-01-15T14:30:00.000Z');
  });

  it('calculates activity density insights', async () => {
    const denseSummary: DailySummary = {
      ...testSummary,
      activities: { ...testSummary.activities, total: 32 },
      sessions: { total: 2, unique: ['s1', 's2'] },
    };

    mockSummaryGenerator.generateSummary = vi.fn().mockResolvedValue(denseSummary);

    await exporter.exportToFile(testDate, '/tmp');

    const capturedContent = mockWriteFile.mock.calls[0][1] as string;
    expect(capturedContent).toContain('⚡ **Intense sessions**');
  });
});