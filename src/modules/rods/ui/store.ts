/** Состояние вкладки «Стержневые системы»: задача, отмена и повтор, готовые задачи, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { Ask, BodyKind, Load, Rod, RodProblem, Support } from '../model/rods';
import { newLoad, newRod, newSupport, ROD_PRESETS, type RodPresetKey } from '../presets';

export const RODS_MODULE = 'rods';
const MAX_RODS = 6,
  MAX_SUPPORTS = 2,
  MAX_LOADS = 5;

export type TopNum = 'L' | 'A' | 'sAllow' | 'sT' | 'n';
export type RodNum = keyof Rod;
export type LoadNum = 'x' | 'x2' | 'F' | 'ang';
export type SupNum = 'x' | 'ang';

export interface RodsState {
  problem: RodProblem;
  title: string;
  preset: RodPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: RodProblem;
  title: string;
  preset: RodsState['preset'];
}
const copy = (p: RodProblem): RodProblem => structuredClone(p);

const ROD_KEYS: RodNum[] = ['x', 'ang', 'l', 'c', 'E', 'alpha', 'dT', 'delta'];

export function parseRods(raw: unknown): { ok: true; problem: RodProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !Array.isArray(raw.rods)) return { ok: false, errors: ['В файле нет задачи (problem с полем rods).'] };
  const e: string[] = [];
  const num = (o: Record<string, unknown>, k: string, def: number, where: string) => {
    if (o[k] === undefined) return def;
    if (!isNum(o[k])) {
      e.push(`${where}: поле ${k} — не число.`);
      return def;
    }
    return o[k] as number;
  };
  const rods: Rod[] = raw.rods.slice(0, MAX_RODS).map((x: unknown, i) => {
    const d = newRod();
    if (!isObj(x)) return (e.push(`Стержень ${i + 1}: нет данных.`), d);
    return Object.fromEntries(ROD_KEYS.map((k) => [k, num(x, k, d[k], `Стержень ${i + 1}`)])) as unknown as Rod;
  });
  const supports: Support[] = (Array.isArray(raw.supports) ? raw.supports : []).slice(0, MAX_SUPPORTS).map((x: unknown, i) => {
    const d = newSupport();
    if (!isObj(x)) return (e.push(`Опора ${i + 1}: нет данных.`), d);
    return { kind: x.kind === 'roller' ? 'roller' : 'pin', x: num(x, 'x', d.x, `Опора ${i + 1}`), ang: num(x, 'ang', d.ang, `Опора ${i + 1}`) };
  });
  const loads: Load[] = (Array.isArray(raw.loads) ? raw.loads : []).slice(0, MAX_LOADS).map((x: unknown, i) => {
    const d = newLoad();
    if (!isObj(x)) return (e.push(`Нагрузка ${i + 1}: нет данных.`), d);
    const kind = x.kind === 'M' || x.kind === 'q' ? x.kind : 'F';
    return {
      kind,
      x: num(x, 'x', d.x, `Нагрузка ${i + 1}`),
      x2: num(x, 'x2', d.x2, `Нагрузка ${i + 1}`),
      F: num(x, 'F', d.F, `Нагрузка ${i + 1}`),
      ang: num(x, 'ang', d.ang, `Нагрузка ${i + 1}`),
    };
  });
  const ask: Ask = ['check', 'design', 'allow', 'limit'].includes(raw.ask as string) ? (raw.ask as Ask) : 'check';
  const p: RodProblem = {
    body: raw.body === 'bar' ? 'bar' : 'node',
    L: num(raw, 'L', 3, 'Задача'),
    supports,
    rods,
    loads,
    A: num(raw, 'A', 2, 'Задача'),
    ask,
    sAllow: num(raw, 'sAllow', 160, 'Задача'),
    sT: num(raw, 'sT', 240, 'Задача'),
    n: num(raw, 'n', 1.5, 'Задача'),
  };
  if (!rods.length) e.push('Нет ни одного стержня.');
  if (e.length) return { ok: false, errors: e };
  return { ok: true, problem: p };
}

export class RodsStore {
  private st: RodsState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: RodPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'a44';
    this.st = {
      problem: copy(ROD_PRESETS[k].problem),
      title: ROD_PRESETS[k].title,
      preset: k,
      canUndo: false,
      canRedo: false,
      notice: null,
      explain: opts.explain ?? true,
    };
  }
  get = (): RodsState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<RodsState>) {
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
  private edit(fn: (p: RodProblem) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  private change(fn: (p: RodProblem) => void) {
    this.commit();
    this.edit(fn);
  }
  loadPreset = (k: RodPresetKey) => {
    this.commit();
    this.set({ problem: copy(ROD_PRESETS[k].problem), title: ROD_PRESETS[k].title, preset: k });
  };
  typeTop = (k: TopNum, v: number) => {
    this.touch(`top:${k}`);
    this.edit((p) => (p[k] = v));
  };
  setBody = (b: BodyKind) =>
    this.change((p) => {
      p.body = b;
      if (b === 'node') {
        p.supports = [];
        p.loads = p.loads.filter((l) => l.kind === 'F');
      } else if (!p.supports.length) p.supports = [newSupport({ x: 0 })];
    });
  setAsk = (a: Ask) => this.change((p) => (p.ask = a));
  /* Стержни. */
  addRod = () => {
    if (this.st.problem.rods.length >= MAX_RODS) return;
    this.change((p) => p.rods.push(newRod({ x: p.body === 'bar' ? p.L : 0 })));
  };
  removeRod = (i: number) => {
    if (this.st.problem.rods.length <= 1) return;
    this.change((p) => p.rods.splice(i, 1));
  };
  typeRod = (i: number, k: RodNum, v: number) => {
    this.touch(`rod:${i}:${k}`);
    this.edit((p) => (p.rods[i][k] = v));
  };
  /* Опоры. */
  addSupport = (kind: Support['kind']) => {
    if (this.st.problem.supports.length >= MAX_SUPPORTS || this.st.problem.body !== 'bar') return;
    this.change((p) => p.supports.push(newSupport({ kind, x: p.L })));
  };
  removeSupport = (j: number) => this.change((p) => p.supports.splice(j, 1));
  setSupportKind = (j: number, kind: Support['kind']) => this.change((p) => (p.supports[j].kind = kind));
  typeSupport = (j: number, k: SupNum, v: number) => {
    this.touch(`sup:${j}:${k}`);
    this.edit((p) => (p.supports[j][k] = v));
  };
  /* Нагрузки. */
  addLoad = (kind: Load['kind']) => {
    if (this.st.problem.loads.length >= MAX_LOADS) return;
    this.change((p) => p.loads.push(newLoad({ kind, x: 0, x2: p.body === 'bar' ? p.L : 1, F: kind === 'M' ? 5 : 10 })));
  };
  removeLoad = (j: number) => this.change((p) => p.loads.splice(j, 1));
  typeLoad = (j: number, k: LoadNum, v: number) => {
    this.touch(`load:${j}:${k}`);
    this.edit((p) => (p.loads[j][k] = v));
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
  exportProject = (now = new Date()) => ({
    name: projectFileName(this.st.title, now),
    text: writeEnvelope(RODS_MODULE, this.st.title, { problem: this.st.problem }, now),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== RODS_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseRods(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Стержневые системы';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
