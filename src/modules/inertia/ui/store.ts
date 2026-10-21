/** Состояние вкладки «Геометрия масс»: части, ось, история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import { KINDS, PARAMS, type IPart, type IProblem, type PartKind, type V3 } from '../model/inertia';
import { INERTIA_PRESETS, type InertiaPresetKey } from '../presets';

export const INERTIA_MODULE = 'inertia';
const MAX_PARTS = 12;

export const DEFAULTS: Record<PartKind, Record<string, number>> = {
  point: {},
  rod: { l: 1 },
  ring: { R: 0.5 },
  disk: { R: 0.5, h: 0 },
  tube: { R: 0.5, r: 0.3, h: 0 },
  cone: { R: 0.3, h: 0.6 },
  sphere: { R: 0.3 },
  hball: { R: 0.3, r: 0.2 },
  shell: { R: 0.3 },
  box: { a: 0.6, b: 0.4, c: 0 },
};
export const newPart = (kind: PartKind): IPart => ({ kind, m: 1, c: [0, 0, 0], u: [0, 0, 1], p: { ...DEFAULTS[kind] }, s: 1 });

export interface InertiaState {
  problem: IProblem;
  title: string;
  preset: InertiaPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: IProblem;
  title: string;
  preset: InertiaState['preset'];
}
const copy = (p: IProblem): IProblem => structuredClone(p);
const isV3 = (x: unknown): x is V3 => Array.isArray(x) && x.length === 3 && x.every(isNum);

export function parseInertia(raw: unknown): { ok: true; problem: IProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !Array.isArray(raw.parts) || !isV3(raw.A) || !isV3(raw.axis)) return { ok: false, errors: ['В файле нет задачи (problem с полями parts, A, axis).'] };
  const e: string[] = [];
  const parts: IPart[] = raw.parts.flatMap((q: unknown, i) => {
    if (!isObj(q) || !KINDS.includes(q.kind as PartKind) || !isNum(q.m) || !isV3(q.c) || !isV3(q.u) || !isObj(q.p)) return (e.push(`Часть №${i + 1}: неполные данные.`), []);
    const kind = q.kind as PartKind;
    const p: Record<string, number> = {};
    for (const [key] of PARAMS[kind]) {
      const val = (q.p as Record<string, unknown>)[key];
      if (!isNum(val)) return (e.push(`Часть №${i + 1}: размер «${key}» — число.`), []);
      p[key] = val;
    }
    return [{ kind, m: q.m, c: q.c, u: q.u, p, s: q.s === -1 ? -1 : 1 } as IPart];
  });
  if (!parts.length || parts.length > MAX_PARTS) e.push(`Частей должно быть от 1 до ${MAX_PARTS}.`);
  return e.length ? { ok: false, errors: e } : { ok: true, problem: { parts, A: raw.A, axis: raw.axis, byWeight: raw.byWeight === true } };
}

export class InertiaStore {
  private st: InertiaState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: InertiaPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm3421';
    this.st = { problem: copy(INERTIA_PRESETS[k].problem as IProblem), title: INERTIA_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): InertiaState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<InertiaState>) {
    this.st = { ...this.st, ...patch, canUndo: this.hist.canUndo, canRedo: this.hist.canRedo };
    this.listeners.forEach((f) => f());
  }
  private snap = (): Snap => ({ problem: this.st.problem, title: this.st.title, preset: this.st.preset });
  private commit() {
    this.hist.push(this.snap());
    if (this.st.preset !== 'custom') this.st = { ...this.st, preset: 'custom', title: 'Своя задача' };
  }
  private touch(key: string) {
    if (this.hist.startSession(key)) this.commit();
  }
  endSession = (key: string) => this.hist.endSession(key);
  private edit(fn: (p: IProblem) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  loadPreset = (k: InertiaPresetKey) => {
    this.commit();
    this.set({ problem: copy(INERTIA_PRESETS[k].problem as IProblem), title: INERTIA_PRESETS[k].title, preset: k });
  };
  addPart = () => {
    if (this.st.problem.parts.length >= MAX_PARTS) return;
    this.commit();
    this.edit((p) => p.parts.push(newPart('disk')));
  };
  removePart = (i: number) => {
    if (this.st.problem.parts.length <= 1) return;
    this.commit();
    this.edit((p) => p.parts.splice(i, 1));
  };
  setKind = (i: number, kind: PartKind) => {
    this.commit();
    this.edit((p) => (p.parts[i] = { ...newPart(kind), m: p.parts[i].m, c: p.parts[i].c, u: p.parts[i].u, s: p.parts[i].s }));
  };
  setSign = (i: number, cut: boolean) => {
    this.commit();
    this.edit((p) => (p.parts[i].s = cut ? -1 : 1));
  };
  setByWeight = (on: boolean) => {
    this.commit();
    this.edit((p) => (p.byWeight = on));
  };
  /** key: m, c0..c2, u0..u2 или размер. */
  typePart = (i: number, key: string, v: number) => {
    this.touch(`p:${i}:${key}`);
    this.edit((p) => {
      const q = p.parts[i];
      if (key === 'm') q.m = v;
      else if (/^[cu][012]$/.test(key)) q[key[0] as 'c' | 'u'][+key[1]] = v;
      else q.p[key] = v;
    });
  };
  /** what: A — точка оси, axis — направление. */
  typeAxis = (what: 'A' | 'axis', a: number, v: number) => {
    this.touch(`a:${what}:${a}`);
    this.edit((p) => (p[what][a] = v));
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
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(INERTIA_MODULE, this.st.title, { problem: this.st.problem }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== INERTIA_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseInertia(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Геометрия масс';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
