"""Shared loading + plotting helpers for the eval report notebooks (eval-report-vi.ipynb / eval-report-en.ipynb).

Data comes from files written by the eval scripts (never from a live server):
  evals/results/*.json            npm run eval / npm run eval:essay
  evals/reports/data/*.json       npm run eval:cache, reference-resolution dump (REF_EVAL_OUT), incident log extract
Charts follow one visual system: three categorical slots in a fixed order, gray for context,
one y-axis per chart, recessive grid, direct labels instead of a number on every mark.
"""
from __future__ import annotations

import glob
import json
import os
from dataclasses import dataclass

import matplotlib.pyplot as plt
import pandas as pd
from matplotlib.ticker import FuncFormatter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RESULTS = os.path.join(ROOT, 'evals', 'results')
DATA = os.path.join(ROOT, 'evals', 'reports', 'data')

# Fixed categorical order (validated palette, slots 1-3 pass all-pairs CVD checks); gray = context.
BLUE, ORANGE, AQUA = '#2a78d6', '#eb6834', '#1baf7a'
GRAY, LIGHT_GRAY, INK, MUTED = '#8a8986', '#d9d8d4', '#0b0b0b', '#52514e'
CONFIG_COLORS = {'v2-k2': BLUE, 'v2-k0': ORANGE, 'v1-k0': AQUA}

T = {
    'vi': {
        'case': 'Câu hỏi', 'score': 'Điểm rule', 'run1': 'Lần chạy 1', 'run2': 'Lần chạy 2 (baseline)',
        'retrieval': 'Truy xuất (RAG)', 'llm': 'Model sinh câu trả lời', 'seconds': 'giây',
        'cached': 'Token đọc từ cache', 'fresh': 'Token tính mới', 'tokens': 'token đầu vào',
        'turn': 'Lượt hội thoại', 'cached_tokens': 'Token được cache', 'words': 'Số từ',
        'target': 'Mục tiêu', 'band': 'Khoảng chấp nhận ±25%', 'ok': 'Đúng', 'fail': 'Sai',
        'group': 'Nhóm tình huống', 'cases': 'số case', 'source': 'Cách chọn artifact',
        'time': 'Thời gian (giờ:phút:giây)', 'event': 'Sự kiện',
        'input': 'Tổng token đầu vào', 'ttft': 'TTFT (giây)',
        'events': {
            'retry_503': 'Retry vì 503', 'circuit_open': 'Ngắt mạch model',
            'fallback': 'Chuyển model dự phòng', 'fallback_404': 'Model dự phòng đã bị gỡ (404)',
            'request_failed_first_token': 'Hết hạn chờ token đầu', 'request_failed_404': 'Request lỗi 404',
        },
        'sources': {'rule': 'Rule (không gọi LLM)', 'ui': 'Client gửi id', 'ambiguous': 'Mơ hồ → hỏi lại', 'none': 'Không cần artifact'},
    },
    'en': {
        'case': 'Question', 'score': 'Rule score', 'run1': 'Run 1', 'run2': 'Run 2 (baseline)',
        'retrieval': 'Retrieval (RAG)', 'llm': 'Answer generation', 'seconds': 'seconds',
        'cached': 'Tokens read from cache', 'fresh': 'Tokens computed fresh', 'tokens': 'input tokens',
        'turn': 'Conversation turn', 'cached_tokens': 'Cached tokens', 'words': 'Words',
        'target': 'Target', 'band': 'Accepted band ±25%', 'ok': 'Correct', 'fail': 'Wrong',
        'group': 'Scenario group', 'cases': 'cases', 'source': 'How the artifact was chosen',
        'time': 'Time (hh:mm:ss)', 'event': 'Event',
        'input': 'Total input tokens', 'ttft': 'TTFT (seconds)',
        'events': {
            'retry_503': 'Retry on 503', 'circuit_open': 'Circuit opened',
            'fallback': 'Fallback to next model', 'fallback_404': 'Fallback model retired (404)',
            'request_failed_first_token': 'First-token timeout', 'request_failed_404': 'Request failed (404)',
        },
        'sources': {'rule': 'Rules (no LLM call)', 'ui': 'Client sent the id', 'ambiguous': 'Ambiguous → ask back', 'none': 'No artifact needed'},
    },
}


def style() -> None:
    plt.rcParams.update({
        'figure.dpi': 110, 'figure.facecolor': '#fcfcfb', 'axes.facecolor': '#fcfcfb',
        'axes.edgecolor': LIGHT_GRAY, 'axes.labelcolor': MUTED, 'axes.titlecolor': INK,
        'axes.titlesize': 12, 'axes.titleweight': 'bold', 'axes.titlelocation': 'left',
        'axes.spines.top': False, 'axes.spines.right': False,
        'axes.grid': True, 'grid.color': '#ecebe7', 'grid.linewidth': 0.8,
        'xtick.color': MUTED, 'ytick.color': MUTED, 'font.size': 10, 'legend.frameon': False,
    })


def _load(path: str):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


# ── Data ────────────────────────────────────────────────────────────────────

def qa_results() -> tuple[pd.DataFrame, dict]:
    """Latest QA golden run (not baseline.json / essay) + run 1 rule scores when present."""
    files = sorted(f for f in glob.glob(os.path.join(RESULTS, '*.json'))
                   if not f.endswith(('baseline.json', '-essay.json')))
    summary = _load(files[-1])
    rows = []
    for r in summary['results']:
        t = r.get('timings') or {}
        llm_ms = sum(a.get('ms', 0) for a in t.get('attempts', []))
        rows.append({
            'id': r['id'], 'score': r['score'], 'judge': r.get('judge'), 'pass': r['pass'],
            'missing': ', '.join(r.get('missingPoints', [])), 'total_s': (t.get('totalMs') or 0) / 1000,
            'retrieval_s': (t.get('retrievalMs') or 0) / 1000, 'llm_s': llm_ms / 1000,
            'input': t.get('inputTokens'), 'cached': t.get('cachedTokens'), 'output': t.get('outputTokens'),
        })
    df = pd.DataFrame(rows)
    run1_path = os.path.join(DATA, 'qa-run1-partial.json')
    if os.path.exists(run1_path):
        df['run1'] = df['id'].map(_load(run1_path)['scores'])
    return df, summary


def essay_results() -> tuple[pd.DataFrame, dict]:
    summary = _load(sorted(glob.glob(os.path.join(RESULTS, '*-essay.json')))[-1])
    rows = []
    for r in summary['results']:
        t = r.get('timings') or {}
        rows.append({
            'id': r['id'], 'score': r['score'], 'words': r['wordCount'], 'target': r['targetWords'],
            'length_ok': r['lengthOk'], 'citations_ok': r['citationsValid'], 'coverage': r['coverage'],
            'llm_calls': t.get('llmCalls'), 'total_s': (t.get('totalMs') or 0) / 1000,
            'input': t.get('inputTokens'), 'cached': t.get('cachedTokens'), 'output': t.get('outputTokens'),
            **{f'judge_{k}': v for k, v in (r.get('judge') or {}).items()},
        })
    return pd.DataFrame(rows), summary


def reference_results() -> pd.DataFrame:
    return pd.DataFrame(_load(os.path.join(DATA, 'reference-resolution.json')))


@dataclass
class CacheRun:
    label: str
    config: str
    scenario: str
    turns: pd.DataFrame


def cache_runs() -> list[CacheRun]:
    runs = []
    for path in sorted(glob.glob(os.path.join(DATA, 'cache-*.json'))):
        d = _load(path)
        label = d['label']
        config = '-'.join(label.split('-')[:2])
        turns = pd.DataFrame(d['turns'])
        for col in ('inputTokens', 'cachedTokens', 'ttftMs', 'totalMs'):
            if col not in turns:
                turns[col] = None
        runs.append(CacheRun(label, config, d.get('scenario', 'c4'), turns))
    return runs


def incident() -> pd.DataFrame:
    df = pd.DataFrame(_load(os.path.join(DATA, 'incident-gemini-503.json')))
    df['ts'] = pd.to_datetime(df['ts'])
    return df


def pct(x: float) -> str:
    return f'{x * 100:.0f}%'


# ── Charts ──────────────────────────────────────────────────────────────────

def plot_qa_runs(df: pd.DataFrame, lang: str):
    """Dumbbell: rule score of run 1 → run 2 per question (same prompt, same model)."""
    t = T[lang]
    d = df.sort_values('id', ascending=False).reset_index(drop=True)
    fig, ax = plt.subplots(figsize=(7.5, 3.6))
    for i, r in d.iterrows():
        if 'run1' in d and pd.notna(r.get('run1')) and abs(r['run1'] - r['score']) > 1e-9:
            ax.plot([r['run1'], r['score']], [i, i], color=LIGHT_GRAY, lw=2, zorder=1)
    if 'run1' in d:
        ax.scatter(d['run1'], d.index, s=60, color=ORANGE, label=t['run1'], zorder=2, edgecolor='#fcfcfb', linewidth=2)
    ax.scatter(d['score'], d.index, s=60, color=BLUE, label=t['run2'], zorder=3, edgecolor='#fcfcfb', linewidth=2)
    ax.set_yticks(d.index, d['id'])
    ax.set_xlim(0.4, 1.05)
    ax.xaxis.set_major_formatter(FuncFormatter(lambda v, _: pct(v)))
    ax.set_xlabel(t['score'])
    ax.grid(axis='y', visible=False)
    ax.legend(loc='lower left', ncol=2)
    return fig


def plot_qa_latency(df: pd.DataFrame, lang: str):
    """Stacked horizontal bars: retrieval vs generation seconds per question."""
    t = T[lang]
    d = df.sort_values('total_s').reset_index(drop=True)
    fig, ax = plt.subplots(figsize=(7.5, 3.6))
    ax.barh(d['id'], d['retrieval_s'], color=AQUA, label=t['retrieval'], height=0.6)
    ax.barh(d['id'], d['llm_s'], left=d['retrieval_s'], color=BLUE, label=t['llm'], height=0.6,
            edgecolor='#fcfcfb', linewidth=2)
    for i, r in d.iterrows():
        ax.text(r['retrieval_s'] + r['llm_s'] + 0.1, i, f"{r['total_s']:.1f}s", va='center', color=MUTED, fontsize=9)
    ax.set_xlabel(t['seconds'])
    ax.grid(axis='y', visible=False)
    ax.legend(loc='lower right')
    return fig


def plot_cross_conversation_cache(df: pd.DataFrame, lang: str):
    """Each QA question is a NEW conversation: how much of its prompt still came from cache."""
    t = T[lang]
    d = df.dropna(subset=['input']).sort_values('id', ascending=False).reset_index(drop=True)
    fresh = d['input'] - d['cached'].fillna(0)
    fig, ax = plt.subplots(figsize=(7.5, 3.6))
    ax.barh(d['id'], d['cached'].fillna(0), color=BLUE, label=t['cached'], height=0.6)
    ax.barh(d['id'], fresh, left=d['cached'].fillna(0), color=LIGHT_GRAY, label=t['fresh'], height=0.6,
            edgecolor='#fcfcfb', linewidth=2)
    for i, r in d.iterrows():
        share = (r['cached'] or 0) / r['input']
        ax.text(r['input'] + 120, i, pct(share), va='center', color=MUTED, fontsize=9)
    ax.set_xlabel(t['tokens'])
    ax.grid(axis='y', visible=False)
    ax.legend(loc='lower right', ncol=2, bbox_to_anchor=(1, -0.32))
    return fig


def plot_essay_length(df: pd.DataFrame, lang: str):
    t = T[lang]
    d = df.sort_values('id', ascending=False).reset_index(drop=True)
    fig, ax = plt.subplots(figsize=(7.5, 2.6))
    for i, r in d.iterrows():
        ax.plot([r['target'] * 0.75, r['target'] * 1.25], [i, i], color=LIGHT_GRAY, lw=10, solid_capstyle='round',
                label=t['band'] if i == 0 else None, zorder=1)
        ax.scatter(r['target'], i, marker='|', s=300, color=GRAY, zorder=2, label=t['target'] if i == 0 else None)
        ax.scatter(r['words'], i, s=70, color=BLUE, zorder=3, edgecolor='#fcfcfb', linewidth=2,
                   label=t['words'] if i == 0 else None)
        ax.text(r['words'] + 12, i + 0.18, f"{r['words']}", color=MUTED, fontsize=9)
    ax.set_yticks(d.index, d['id'])
    ax.set_xlabel(t['words'])
    ax.grid(axis='y', visible=False)
    ax.legend(loc='upper center', ncol=3, bbox_to_anchor=(0.5, -0.32))
    return fig


def plot_reference_groups(df: pd.DataFrame, lang: str):
    t = T[lang]
    g = df.groupby('group').agg(ok=('ok', 'sum'), n=('ok', 'size')).reset_index()
    g['fail'] = g['n'] - g['ok']
    g = g.sort_values('n')
    fig, ax = plt.subplots(figsize=(7.5, 3.4))
    ax.barh(g['group'], g['ok'], color=BLUE, label=t['ok'], height=0.6)
    ax.barh(g['group'], g['fail'], left=g['ok'], color=ORANGE, label=t['fail'], height=0.6)
    for i, (_, r) in enumerate(g.iterrows()):
        ax.text(r['n'] + 0.1, i, f"{int(r['ok'])}/{int(r['n'])}", va='center', color=MUTED, fontsize=9)
    ax.set_xlabel(t['cases'])
    ax.grid(axis='y', visible=False)
    ax.legend(loc='lower right')
    return fig


def plot_reference_sources(df: pd.DataFrame, lang: str):
    t = T[lang]
    s = df['source'].map(t['sources']).value_counts().sort_values()
    fig, ax = plt.subplots(figsize=(7.5, 2.2))
    ax.barh(s.index, s.values, color=BLUE, height=0.55)
    for i, v in enumerate(s.values):
        ax.text(v + 0.2, i, str(v), va='center', color=MUTED, fontsize=9)
    ax.set_xlabel(t['cases'])
    ax.grid(axis='y', visible=False)
    return fig


def plot_cache_turns(runs: list[CacheRun], scenario: str, lang: str, metric: str = 'cachedTokens'):
    """Small multiples, one panel per layout config, shared y-axis: cached tokens per turn."""
    t = T[lang]
    configs = [c for c in CONFIG_COLORS if any(r.config == c and r.scenario == scenario for r in runs)]
    fig, axes = plt.subplots(1, len(configs), figsize=(8.5, 3.0), sharey=True)
    axes = [axes] if len(configs) == 1 else list(axes)
    for ax, config in zip(axes, configs):
        for k, run in enumerate(r for r in runs if r.config == config and r.scenario == scenario):
            d = run.turns[run.turns['ok'] & run.turns[metric].notna()]
            ax.plot(d['turn'], d[metric], color=CONFIG_COLORS[config], lw=2, marker='o', ms=7, mec='#fcfcfb', mew=2,
                    alpha=1 if k == 0 else 0.4)
        ax.set_title(config, fontsize=10)
        ax.set_xlabel(t['turn'])
        ax.set_ylim(0, 7000)
        ax.xaxis.set_major_locator(plt.MaxNLocator(integer=True))
    axes[0].set_ylabel(t['cached_tokens'] if metric == 'cachedTokens' else t['input'])
    fig.tight_layout()
    return fig


def plot_cache_blocks(run: CacheRun, lang: str):
    """Input vs cached tokens per turn of one run: cache grows in ~2k-token steps and trails one turn."""
    t = T[lang]
    d = run.turns[run.turns['ok'] & run.turns['inputTokens'].notna()]
    fig, ax = plt.subplots(figsize=(7.5, 3.4))
    ax.plot(d['turn'], d['inputTokens'], color=GRAY, lw=2, marker='o', ms=7, mec='#fcfcfb', mew=2, label=t['input'])
    ax.step(d['turn'], d['cachedTokens'], where='mid', color=BLUE, lw=2, label=t['cached_tokens'])
    ax.scatter(d['turn'], d['cachedTokens'], color=BLUE, s=50, zorder=3, edgecolor='#fcfcfb', linewidth=2)
    for y in range(2037, int(d['inputTokens'].max()) + 2037, 2037):
        ax.axhline(y, color='#ecebe7', lw=0.8, ls='--', zorder=0)
    ax.set_xlabel(t['turn'])
    ax.set_ylabel(t['tokens'])
    ax.set_ylim(bottom=0)
    ax.xaxis.set_major_locator(plt.MaxNLocator(integer=True))
    ax.legend(loc='upper left', ncol=2)
    return fig


def plot_incident(df: pd.DataFrame, lang: str):
    t = T[lang]
    order = ['retry_503', 'circuit_open', 'fallback', 'fallback_404', 'request_failed_first_token', 'request_failed_404']
    colors = {'retry_503': GRAY, 'circuit_open': BLUE, 'fallback': AQUA, 'fallback_404': ORANGE,
              'request_failed_first_token': ORANGE, 'request_failed_404': ORANGE}
    markers = {'retry_503': 'o', 'circuit_open': 'D', 'fallback': '>', 'fallback_404': 'x',
               'request_failed_first_token': 's', 'request_failed_404': 'X'}
    present = [k for k in order if k in set(df['kind'])]
    fig, ax = plt.subplots(figsize=(7.5, 3.2))
    for i, k in enumerate(present):
        d = df[df['kind'] == k]
        ax.scatter(d['ts'], [i] * len(d), color=colors[k], marker=markers[k], s=60, zorder=3)
    ax.set_yticks(range(len(present)), [t['events'][k] for k in present])
    ax.set_xlabel(t['time'])
    ax.grid(axis='y', visible=False)
    ax.xaxis.set_major_formatter(plt.matplotlib.dates.DateFormatter('%H:%M:%S'))
    return fig
