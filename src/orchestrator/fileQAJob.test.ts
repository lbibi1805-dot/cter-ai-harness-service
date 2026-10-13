import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AIInvocationService, PromptPreparer } from '../modules/ai';
import { PollJobName, PollSchedulerService, type PollCursorRepository } from '../modules/polling';
import { StateManager } from '../state/stateManager';
import type { AIAdapter, AppConfig, CanvasAccountConfig, CanvasFile, CanvasFolder } from '../types';
import type { EmailNotifier } from '../utils/emailNotifier';
import { FileQAJob, type CanvasFilesClient, type ResultRenderer } from './fileQAJob';
import { StorageProvider } from '../shared/database/database.enums';

const ACCOUNT: CanvasAccountConfig = { url: 'https://canvas', apiKey: 'k', index: 1 };
const FOLDERS: CanvasFolder[] = [
  { id: 2, name: 'Q', full_name: 'Materials2/Q', parent_folder_id: 1 },
  { id: 3, name: 'A', full_name: 'Materials2/A', parent_folder_id: 1 },
];

/** In-memory Canvas with the same `since` semantics as CanvasClient (updated_at >= since). */
class FakeCanvas implements CanvasFilesClient {
  input: CanvasFile[] = [];
  uploaded: { name: string; body: string }[] = [];
  downloads = 0;
  failListing = false;
  downloadError: Error | null = null;

  addInput(name: string, updatedAt: string): CanvasFile {
    const file = { id: this.input.length + 100, display_name: name, url: `https://canvas/files/${name}`, size: 1, updated_at: updatedAt };
    this.input.push(file);
    return file;
  }

  async findFolderByPath() { return { id: 1, name: 'Materials2', full_name: 'Materials2', parent_folder_id: null }; }
  async listSubfolders() { return FOLDERS; }
  async createFolder(): Promise<CanvasFolder> { throw new Error('not expected'); }
  async listFilesInFolder(_id: number, since?: Date) {
    if (this.failListing) throw new Error('Canvas listFilesInFolder failed: 500 Internal Server Error');
    return this.input
      .filter((f) => !since || new Date(f.updated_at) >= since)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  async listAllFilesInFolder() {
    return this.uploaded.map((u, i) => ({ id: i, display_name: u.name, url: '', size: 1, updated_at: '' }));
  }
  async downloadFile(url: string) {
    this.downloads++;
    if (this.downloadError) throw this.downloadError;
    return Buffer.from(`question from ${url}`);
  }
  async uploadFileToFolder(_folderId: number, name: string, content: Buffer) {
    this.uploaded.push({ name, body: content.toString() });
  }
}

function textRenderer() {
  const r = {
    failSuccess: false,
    failError: false,
    success: vi.fn(async (_n: string, _p: string, model: string, answer: string) => {
      if (r.failSuccess) throw new Error('Protocol error: Connection closed.');
      return Buffer.from(`OK ${model}: ${answer}`);
    }),
    error: vi.fn(async (_n: string, _p: string, _m: string, error: Error) => {
      if (r.failError) throw new Error('Protocol error: Connection closed.');
      return Buffer.from(`ERROR: ${error.message}`);
    }),
    invalidModel: vi.fn(async (_n: string, _p: string, model: string) => Buffer.from(`INVALID ${model}`)),
  };
  return r satisfies ResultRenderer;
}

function config(): AppConfig {
  return {
    accounts: [ACCOUNT],
    aiKeys: { gemini: 'k' },
    defaultModels: { claude: 'c', gemini: 'gemini-3.5-flash', grok: 'g', openai: 'o' },
    modelFallback: { claude: [], gemini: [], grok: [], openai: [] },
    pollIntervalMs: 1000,
    maxRetryCount: 1,
    systemPrompt: 'sys',
    knowledgeContent: '',
    grokBaseUrl: '',
    aiTimeoutMs: 1000,
    gmail: {},
    canvasFolder: { materials: 'Materials2', input: 'Q', output: 'A' },
    database: { provider: StorageProvider.FILE },
    pollAutostart: false,
  };
}

let canvas: FakeCanvas;
let renderer: ReturnType<typeof textRenderer>;
let aiProcess: Mock<AIAdapter['process']>;
let state: StateManager;
let job: FileQAJob;
let notifier: { notifySuccess: ReturnType<typeof vi.fn>; notifyError: ReturnType<typeof vi.fn> };

function memoryCursors(): PollCursorRepository & { data: Map<string, Date> } {
  const data = new Map<string, Date>();
  return {
    data,
    get: async (j, a) => data.get(`${j}:${a}`) ?? null,
    save: async (j, a, c) => { data.set(`${j}:${a}`, c); },
  };
}

beforeEach(() => {
  canvas = new FakeCanvas();
  renderer = textRenderer();
  aiProcess = vi.fn<AIAdapter['process']>(async () => '# Answer');
  const adapter: AIAdapter = { validate: async () => undefined, process: aiProcess };
  const ai = new AIInvocationService(config(), new PromptPreparer('sys', ''), { createAdapter: () => adapter, sleep: async () => undefined });
  state = new StateManager(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fileqa-')), 'processed.json'));
  state.load();
  notifier = { notifySuccess: vi.fn(), notifyError: vi.fn() };
  job = new FileQAJob(config(), state, notifier as unknown as EmailNotifier, ai, {
    createClient: () => canvas,
    extract: async (buffer) => ({ textContent: buffer.toString(), imageBuffers: [] }),
    renderer,
    sleep: async () => undefined,
  });
});

describe('FileQAJob', () => {
  it('answers every new file oldest-first and advances the cursor to the newest', async () => {
    canvas.addInput('START_b_gemini.txt', '2026-10-01T10:05:00Z');
    canvas.addInput('START_a_gemini.txt', '2026-10-01T10:00:00Z');

    const { nextCursor } = await job.run(ACCOUNT, { cursor: null });

    expect(canvas.uploaded.map((u) => u.name)).toEqual(['START_a_gemini_DONE.pdf', 'START_b_gemini_DONE.pdf']);
    expect(canvas.uploaded[0].body).toBe('OK gemini-3.5-flash: # Answer');
    expect(state.getStatus('101')).toBe('done');
    expect(nextCursor).toEqual(new Date('2026-10-01T10:05:00Z'));
  });

  it('skips files already answered on Canvas without calling AI', async () => {
    canvas.addInput('START_a_gemini.txt', '2026-10-01T10:00:00Z');
    canvas.uploaded.push({ name: 'START_a_gemini_DONE.pdf', body: 'old' });
    const { nextCursor } = await job.run(ACCOUNT, { cursor: null });
    expect(aiProcess).not.toHaveBeenCalled();
    expect(nextCursor).toEqual(new Date('2026-10-01T10:00:00Z'));
  });

  it('fails fast on a permanent download error (no 25× retry) and delivers an error PDF', async () => {
    canvas.addInput('START_a_grok.txt', '2026-10-01T10:00:00Z');
    canvas.downloadError = new Error('Canvas download failed: 400 Bad Request');
    await job.run(ACCOUNT, { cursor: null });
    expect(canvas.downloads).toBe(1);
    expect(aiProcess).not.toHaveBeenCalled();
    expect(canvas.uploaded[0]).toEqual({ name: 'START_a_grok_DONE.pdf', body: 'ERROR: Canvas download failed: 400 Bad Request' });
    expect(state.getStatus('100')).toBe('failed');
  });

  it('downloads and extracts once even when the AI needs retries', async () => {
    canvas.addInput('START_a_gemini.txt', '2026-10-01T10:00:00Z');
    aiProcess.mockRejectedValueOnce(Object.assign(new Error('HTTP 503'), { status: 503 }));
    await job.run(ACCOUNT, { cursor: null });
    expect(aiProcess).toHaveBeenCalledTimes(2);
    expect(canvas.downloads).toBe(1);
    expect(state.getStatus('100')).toBe('done');
  });

  it('marks the file failed with an error PDF when every model fails', async () => {
    canvas.addInput('START_a_gemini.txt', '2026-10-01T10:00:00Z');
    aiProcess.mockRejectedValue(Object.assign(new Error('quota exceeded'), { status: 429 }));
    const { nextCursor } = await job.run(ACCOUNT, { cursor: null });
    expect(canvas.uploaded[0].body).toBe('ERROR: quota exceeded');
    expect(state.getStatus('100')).toBe('failed');
    expect(nextCursor).toEqual(new Date('2026-10-01T10:00:00Z'));
    expect(notifier.notifyError).not.toHaveBeenCalled();
  });

  it('rejects an unknown model in the file name', async () => {
    canvas.addInput('START_a_gemini_nope-1.txt', '2026-10-01T10:00:00Z');
    await job.run(ACCOUNT, { cursor: null });
    expect(canvas.uploaded[0]).toEqual({ name: 'START_a_gemini_nope-1_DONE.pdf', body: 'INVALID nope-1' });
    expect(aiProcess).not.toHaveBeenCalled();
    expect(state.getStatus('100')).toBe('failed');
  });

  describe('when PDF rendering is broken (dead Chromium)', () => {
    it('defers the file instead of failing it, keeps going, and holds the cursor before it', async () => {
      canvas.addInput('START_a_gemini.txt', '2026-10-01T10:00:00Z');
      canvas.addInput('START_b_gemini.txt', '2026-10-01T10:05:00Z');
      renderer.success.mockImplementationOnce(async () => { throw new Error('Protocol error: Connection closed.'); })
        .mockImplementationOnce(async () => { throw new Error('Protocol error: Connection closed.'); });

      const { nextCursor } = await job.run(ACCOUNT, { cursor: null });

      expect(state.getStatus('100')).toBe('processing');
      expect(state.getStatus('101')).toBe('done');
      expect(canvas.uploaded.map((u) => u.name)).toEqual(['START_b_gemini_DONE.pdf']);
      expect(nextCursor).toBeNull();
    });

    it('defers (never marks failed) when even the error PDF cannot be delivered', async () => {
      canvas.addInput('START_a_gemini.txt', '2026-10-01T10:00:00Z');
      aiProcess.mockRejectedValue(Object.assign(new Error('bad request'), { status: 400 }));
      renderer.failError = true;
      await job.run(ACCOUNT, { cursor: null });
      expect(state.getStatus('100')).toBe('processing');
      expect(canvas.uploaded).toEqual([]);
    });
  });
});

describe('FileQAJob + PollScheduler (regressions from production)', () => {
  function makeScheduler(cursors = memoryCursors()) {
    const staleMs = 60_000;
    return {
      cursors,
      scheduler: new PollSchedulerService({
        intervalMs: 1000,
        accounts: [ACCOUNT],
        jobs: [job],
        cursors,
        beforeTick: () => { state.resetStaleProcessing(staleMs); },
      }),
    };
  }

  it('does not lose a file when a tick fails (old lastPollTime bug)', async () => {
    const { scheduler, cursors } = makeScheduler();
    canvas.addInput('START_first_gemini.txt', '2026-10-01T09:00:00Z');
    await scheduler.runTick();
    expect(cursors.data.get(`${PollJobName.FILE_QA}:1`)).toEqual(new Date('2026-10-01T09:00:00Z'));

    // Uploaded to Canvas before the next tick, but that tick hits a Canvas 500.
    canvas.addInput('START_late_gemini.txt', '2026-10-01T09:30:00Z');
    canvas.failListing = true;
    const failed = await scheduler.runTick();
    expect(failed!.failures).toHaveLength(1);

    // Canvas recovers: the file must still be picked up.
    canvas.failListing = false;
    await scheduler.runTick();
    expect(canvas.uploaded.map((u) => u.name)).toContain('START_late_gemini_DONE.pdf');
    expect(cursors.data.get(`${PollJobName.FILE_QA}:1`)).toEqual(new Date('2026-10-01T09:30:00Z'));
  });

  it('retries a deferred file after the stale reset instead of stranding it as pending', async () => {
    const { scheduler } = makeScheduler();
    canvas.addInput('START_a_gemini.txt', '2026-10-01T10:00:00Z');
    renderer.failSuccess = true;
    await scheduler.runTick();
    expect(state.getStatus('100')).toBe('processing');

    // Next tick while still "processing": skipped, not lost.
    await scheduler.runTick();
    expect(canvas.uploaded).toEqual([]);

    // Renderer recovers and the record goes stale → retried and delivered.
    renderer.failSuccess = false;
    const realNow = Date.now;
    vi.spyOn(Date, 'now').mockReturnValue(realNow() + 120_000);
    await scheduler.runTick();
    vi.mocked(Date.now).mockRestore();

    expect(canvas.uploaded.map((u) => u.name)).toEqual(['START_a_gemini_DONE.pdf']);
    expect(state.getStatus('100')).toBe('done');
  });
});
