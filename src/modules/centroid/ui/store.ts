/** Состояние вкладки «Центр тяжести»: режим, части, история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import { KINDS, PARAMS, type CPart, type CProblem, type Mode, type PartKind } from '../model/centroid';
import { CENTROID_PRESETS, type CentroidPresetKey } from '../presets';
import { extraProblem, findAsk, parseExtra, type ExtraProblem } from '../../../shared/extra';
import { CENTROID_ASKS } from '../model/extra';
import { CENTROID_EXTRA_PRESETS, type CentroidExtraKey } from '../extraPresets';

export const CENTROID_MODULE = 'centroid';
const MAX_PARTS = 12;

/** Параметры новой части по умолчанию. */
export const DEFAULTS: Record<PartKind, Record<string, number>> = {
  rect: { x: 0, y: 0, w: 4, h: 2 },
  tri: { x1: 0, y1: 0, x2: 3, y2: 0, x3: 0, y3: 3 },
  poly: {},
  circle: { cx: 1, cy: 1, r: 0.5 },
  sector: { cx: 0, cy: 0, r: 2, a1: 0, a2: 90 },
  segment: { cx: 0, cy: 0, r: 2, a1: 60, a2: 120 },
  line: { x1: 0, y1: 0, z1: 0, x2: 2, y2: 0, z2: 0 },
  arc: { cx: 0, cy: 0, r: 1, a1: 0, a2: 180 },
  point: { x: 0, y: 0, z: 0, w: 1 },
  box: { x: 0, y: 0, z: 0, a: 2, b: 2, c: 2 },
  cyl: { x: 0, y: 0, z: 0, r: 1, h: 2, ax: 2, dir: 1 },
  cone: { x: 0, y: 0, z: 0, r: 1, h: 2, ax: 2, dir: 1 },
  sphere: { x: 0, y: 0, z: 0, r: 1 },
  hemi: { x: 0, y: 0, z: 0, r: 1, ax: 2, dir: -1 },
  frustum: { x: 0, y: 0, z: 0, a: 4, b: 1, h: 2, ax: 2, dir: 1 },
  tri3: { x1: 0, y1: 0, z1: 0, x2: 2, y2: 0, z2: 0, x3: 0, y3: 0, z3: 2 },
  quad3: { x1: 0, y1: 0, z1: 0, x2: 2, y2: 0, z2: 0, x3: 2, y3: 2, z3: 0, x4: 0, y4: 2, z4: 0 },
  cylsurf: { x: 0, y: 0, z: 0, r: 1, h: 2, ax: 2, dir: 1 },
  capsurf: { x: 0, y: 0, z: 0, r: 1, h: 0.5, ax: 2, dir: 1 },
};
export const newPart = (kind: PartKind): CPart => ({
  kind,
  p: { ...DEFAULTS[kind] },
  s: 1,
  k: 1,
  ...(kind === 'poly'
    ? {
        pts: [
          [0, 0],
          [3, 0],
          [2, 2],
          [0, 2],
        ] as [number, number][],
      }
    : {}),
});

export interface CentroidState {
  problem: CProblem;
  /** Экран обратных задач (пункт 26). */
  extra: ExtraProblem;
  view: 'main' | 'extra';
  title: string;
  preset: CentroidPresetKey | CentroidExtraKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: CProblem;
  extra: ExtraProblem;
  view: 'main' | 'extra';
  title: string;
  preset: CentroidState['preset'];
}
const copy = (p: CProblem): CProblem => structuredClone(p);

export function parseProblem(raw: unknown): { ok: true; problem: CProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !['area', 'line', 'volume', 'surface', 'mass'].includes(raw.mode as string) || !Array.isArray(raw.parts)) return { ok: false, errors: ['В файле нет задачи (problem с полями mode и parts).'] };
  const mode = raw.mode as Mode;
  const e: string[] = [];
  const parts: CPart[] = raw.parts.flatMap((q: unknown, i) => {
    if (!isObj(q) || !KINDS[mode].includes(q.kind as PartKind) || !isObj(q.p)) return (e.push(`Часть №${i + 1}: вид не подходит к режиму.`), []);
    const kind = q.kind as PartKind;
    const p: Record<string, number> = {};
    for (const [key] of PARAMS[kind]) {
      const val = (q.p as Record<string, unknown>)[key];
      if (!isNum(val)) return (e.push(`Часть №${i + 1}: параметр «${key}» — число.`), []);
      p[key] = val;
    }
    const pts = kind === 'poly' && Array.isArray(q.pts) ? (q.pts.filter((t) => Array.isArray(t) && t.length === 2 && isNum(t[0]) && isNum(t[1])) as [number, number][]) : undefined;
    if (kind === 'poly' && (!pts || pts.length < 3)) return (e.push(`Часть №${i + 1}: у многоугольника не меньше трёх вершин.`), []);
    return [{ kind, p, s: q.s === -1 ? -1 : 1, k: isNum(q.k) ? q.k : 1, ...(pts ? { pts } : {}) } as CPart];
  });
  if (!parts.length || parts.length > MAX_PARTS) e.push(`Частей должно быть от 1 до ${MAX_PARTS}.`);
  return e.length ? { ok: false, errors: e } : { ok: true, problem: { mode, parts } };
}

export class CentroidStore {
  private st: CentroidState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: CentroidPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm912';
    this.st = { problem: copy(CENTROID_PRESETS[k].problem as CProblem), extra: structuredClone(CENTROID_EXTRA_PRESETS.x913.problem), view: 'main', title: CENTROID_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): CentroidState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<CentroidState>) {
    this.st = { ...this.st, ...patch, canUndo: this.hist.canUndo, canRedo: this.hist.canRedo };
    this.listeners.forEach((f) => f());
  }
  private snap = (): Snap => ({ problem: this.st.problem, extra: this.st.extra, view: this.st.view, title: this.st.title, preset: this.st.preset });
  private commit() {
    this.hist.push(this.snap());
    if (this.st.preset !== 'custom') this.st = { ...this.st, preset: 'custom', title: 'Своя задача' };
  }
  private touch(key: string) {
    if (this.hist.startSession(key)) this.commit();
  }
  endSession = (key: string) => this.hist.endSession(key);
  private edit(fn: (p: CProblem) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  loadPreset = (k: CentroidPresetKey | CentroidExtraKey) => {
    this.commit();
    if (k in CENTROID_EXTRA_PRESETS) {
      const e = CENTROID_EXTRA_PRESETS[k as CentroidExtraKey];
      return this.set({ extra: structuredClone(e.problem), view: 'extra', title: e.title, preset: k });
    }
    const m = CENTROID_PRESETS[k as CentroidPresetKey];
    this.set({ problem: copy(m.problem as CProblem), view: 'main', title: m.title, preset: k });
  };
  /* ---------- обратные задачи (пункт 26) ---------- */
  setView = (view: 'main' | 'extra') => {
    if (view !== this.st.view) this.set({ view });
  };
  private editX(fn: (x: ExtraProblem) => void) {
    const x = structuredClone(this.st.extra);
    fn(x);
    this.set({ extra: x });
  }
  setXAsk = (id: string) => {
    this.commit();
    this.set({ extra: extraProblem(findAsk(CENTROID_ASKS, id)) });
  };
  typeNum = (k: string, v: number) => {
    this.touch(`x:${k}`);
    this.editX((x) => (x.n[k] = v));
  };
  typeText = (k: string, s: string) => {
    this.touch(`x:${k}`);
    this.editX((x) => (x.s[k] = s.slice(0, 300)));
  };
  pick = (k: string, v: string) => {
    this.commit();
    this.editX((x) => (x.s[k] = v));
  };
  /** Смена режима: части заменяются одной частью подходящего вида. */
  setMode = (mode: Mode) => {
    if (mode === this.st.problem.mode) return;
    this.commit();
    this.set({ problem: { mode, parts: [newPart(KINDS[mode][0])] } });
  };
  addPart = () => {
    if (this.st.problem.parts.length >= MAX_PARTS) return;
    this.commit();
    this.edit((p) => p.parts.push(newPart(KINDS[p.mode][0])));
  };
  removePart = (i: number) => {
    if (this.st.problem.parts.length <= 1) return;
    this.commit();
    this.edit((p) => p.parts.splice(i, 1));
  };
  setKind = (i: number, kind: PartKind) => {
    this.commit();
    this.edit((p) => (p.parts[i] = { ...newPart(kind), s: p.parts[i].s, k: p.parts[i].k }));
  };
  setSign = (i: number, cut: boolean) => {
    this.commit();
    this.edit((p) => (p.parts[i].s = cut ? -1 : 1));
  };
  setParam = (i: number, key: string, v: number) => {
    this.commit();
    this.edit((p) => (p.parts[i].p[key] = v));
  };
  typeParam = (i: number, key: string, v: number) => {
    this.touch(`p:${i}:${key}`);
    this.edit((p) => (key === 'k' ? (p.parts[i].k = v) : (p.parts[i].p[key] = v)));
  };
  /** Вершины многоугольника из текста «x y; x y; …». */
  typePts = (i: number, pts: [number, number][]) => {
    this.touch(`pts:${i}`);
    this.edit((p) => (p.parts[i].pts = pts));
  };
  undo = () => {
    const s = this.hist.undo(this.snap());
    if (s) this.set(s);
  };
  redo = () => {
    const s = this.hist.redo(this.snap());
    if (s) this.set(s);
  };
  notify = (text: string, tone: 'ok' | 'bad' = 'ok') => this.set({ notice: { text, tone, seq: (this.st.notice?.seq ?? 0) + 1 } });
  closeNotice = () => this.set({ notice: null });
  setExplain = (explain: boolean) => this.set({ explain });
  projectTitle = () => this.st.title;
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(CENTROID_MODULE, this.st.title, { problem: this.st.problem, extra: this.st.extra, view: this.st.view }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== CENTROID_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseProblem(env.raw.problem);
    const ex = parseExtra(env.raw.extra, CENTROID_ASKS);
    const view = env.raw.view === 'extra' && ex ? 'extra' : 'main';
    if (!r.ok && view !== 'extra') return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Центр тяжести';
    this.set({ problem: r.ok ? r.problem : this.st.problem, extra: ex ?? this.st.extra, view, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
