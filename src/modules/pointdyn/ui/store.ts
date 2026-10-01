/** Состояние вкладки «Динамика точки»: силы, начальные условия, вопрос; история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { PointProblem } from '../model/point';
import { POINT_PRESETS, type PointPresetKey } from '../presets';

export const POINT_MODULE = 'pointdyn';
export const NUM_KEYS = ['m', 'alpha', 'f', 'F0', 'at', 'F1', 'p', 'c', 'kv', 'kq', 'x0', 'v0', 't', 'v1', 'x1'] as const;
export type PointNumKey = (typeof NUM_KEYS)[number];

export interface PointState {
  problem: PointProblem;
  title: string;
  preset: PointPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: PointProblem;
  title: string;
  preset: PointState['preset'];
}
const copy = (p: PointProblem): PointProblem => structuredClone(p);

export function parsePoint(raw: unknown): { ok: true; problem: PointProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !NUM_KEYS.every((k) => isNum(raw[k])) || !['t', 'v', 'x'].includes(raw.ask as string)) return { ok: false, errors: ['В файле нет задачи (problem с числовыми полями m, alpha, f, F0, … и ask).'] };
  const nums = Object.fromEntries(NUM_KEYS.map((k) => [k, raw[k]])) as Record<PointNumKey, number>;
  return { ok: true, problem: { ...nums, byWeight: raw.byWeight === true, up: raw.up === true, ask: raw.ask as PointProblem['ask'] } };
}

export class PointStore {
  private st: PointState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: PointPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm277';
    this.st = { problem: copy(POINT_PRESETS[k].problem as PointProblem), title: POINT_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): PointState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<PointState>) {
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
  private edit(fn: (p: PointProblem) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  loadPreset = (k: PointPresetKey) => {
    this.commit();
    this.set({ problem: copy(POINT_PRESETS[k].problem as PointProblem), title: POINT_PRESETS[k].title, preset: k });
  };
  typeNum = (key: PointNumKey, v: number) => {
    this.touch(`n:${key}`);
    this.edit((p) => (p[key] = v));
  };
  setUp = (up: boolean) => {
    this.commit();
    this.edit((p) => (p.up = up));
  };
  setByWeight = (on: boolean) => {
    this.commit();
    this.edit((p) => (p.byWeight = on));
  };
  setAsk = (ask: PointProblem['ask']) => {
    this.commit();
    this.edit((p) => (p.ask = ask));
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
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(POINT_MODULE, this.st.title, { problem: this.st.problem }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== POINT_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parsePoint(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Динамика точки';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
