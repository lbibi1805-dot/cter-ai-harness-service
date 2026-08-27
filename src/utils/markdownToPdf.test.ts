import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { markdownToPdf, closeBrowser } from './markdownToPdf';

describe('markdownToPdf — Mermaid + PDF output', () => {
  beforeAll(() => {
    // Chromium is launched lazily by markdownToPdf; nothing to do here.
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it('produces a valid PDF buffer with the %PDF header', async () => {
    const { buffer } = await markdownToPdf('Header test', {}, 'Nội dung đơn giản');
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('renders a QNX thread-state flowchart (vault: Week-02)', async () => {
    const body = [
      '# Thread States (QNX)',
      '',
      '```mermaid',
      'stateDiagram-v2',
      '    [*] --> Ready',
      '    Ready --> Running: Dispatch',
      '    Running --> Ready: Timer_run_out',
      '    Running --> Blocked: Block',
      '    Blocked --> Ready: Wakeup',
      '    Running --> [*]: Exit',
      '```',
      '',
      'QNX chẻ nhỏ 4 trạng thái cơ bản thành 21 trạng thái chi tiết.',
    ].join('\n');

    const { buffer, renderLog } = await markdownToPdf('QNX', { Provider: 'test', Model: 'm' }, body);
    expect(renderLog).toHaveLength(1);
    expect(renderLog[0].ok).toBe(true);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('renders a pointer memory-map diagram (vault: C-POINTER)', async () => {
    const body = [
      '# Con trỏ trong C/C++',
      '',
      '```mermaid',
      'graph LR',
      '    subgraph RAM [Bộ nhớ]',
      '        ADDR[0x7FFC]',
      '        VAL[Giá trị: 404]',
      '    end',
      '    BANDO[int* ban_do] -->|&ruong| ADDR',
      '    ADDR -->|dereference| VAL',
      '```',
      '',
      '`&` lấy địa chỉ, `*` truy xuất giá trị.',
    ].join('\n');

    const { renderLog } = await markdownToPdf('Pointer', {}, body);
    expect(renderLog).toHaveLength(1);
    expect(renderLog[0].ok).toBe(true);
  });

  it('renders multiple Mermaid blocks (flowchart + sequence + class)', async () => {
    const body = [
      '```mermaid',
      'graph TD',
      '    A[Process A] --> B(Process B)',
      '```',
      '',
      '```mermaid',
      'sequenceDiagram',
      '    participant Main',
      '    participant Thread B',
      '    Main->>Thread B: pthread_create()',
      '    Thread B-->>Main: return 152',
      '```',
      '',
      '```mermaid',
      'classDiagram',
      '    class Process {',
      '        +int pid',
      '        +schedule()',
      '    }',
      '    class Thread {',
      '        +int tid',
      '        +run()',
      '    }',
      '    Process *-- Thread',
      '```',
    ].join('\n');

    const { renderLog } = await markdownToPdf('Multi', {}, body);
    expect(renderLog).toHaveLength(3);
    expect(renderLog.every(r => r.ok)).toBe(true);
  });

  it('renders LaTeX math alongside Mermaid (vault: Week-02 equations)', async () => {
    const body = [
      '# Công thức',
      '',
      'Tổng thời gian chạy nếu dùng thread: $T = max(t_1, t_2)$',
      '',
      '```mermaid',
      'graph LR',
      '    S[sleep 5s] --> M[sleep 6s]',
      '```',
      '',
      '$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$',
    ].join('\n');

    const { renderLog } = await markdownToPdf('Math', {}, body);
    expect(renderLog).toHaveLength(1);
    expect(renderLog[0].ok).toBe(true);
  });

  it('degrades a broken Mermaid block to a code fallback and logs the error', async () => {
    const body = [
      '```mermaid',
      'graph TD',
      '    A --> B',
      '```',
      '',
      '```mermaid',
      'this is not valid mermaid %%',
      '  broken ->> syntax [x',
      '```',
    ].join('\n');

    const { buffer, renderLog } = await markdownToPdf('Fallback', {}, body);
    expect(renderLog).toHaveLength(2);
    expect(renderLog[0].ok).toBe(true);
    expect(renderLog[1].ok).toBe(false);
    expect(renderLog[1].error).toBeTruthy();
    // Still a valid PDF even when a block fails
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('renders a table from the vault (Process vs Thread comparison)', async () => {
    const body = [
      '| Đặc điểm | Process | Thread |',
      '|----------|---------|--------|',
      '| Bộ nhớ   | Không chia sẻ | Chia sẻ address space |',
      '| Tài nguyên riêng | Hoạt động độc lập | Stack riêng |',
      '| Độ tin cậy | Cao (memory barrier) | Thấp (sập chùm) |',
    ].join('\n');

    const { buffer } = await markdownToPdf('Table', {}, body);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
