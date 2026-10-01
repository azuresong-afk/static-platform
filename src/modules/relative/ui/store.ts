/** Состояние вкладки «Сложное движение точки»: переносное и относительное движения, момент; история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { Plane, RelProblem } from '../model/rel';
import { REL0, REL_PRESETS, type RelPresetKey } from '../presets';

export const REL_MODULE = 'relative';
export const REL_STR = ['phi', 'xe', 'ye', 'ze', 'x', 'y', 'z', 'ang', 'R', 's'] as const;
export type RelStrKey = (typeof REL_STR)[number];

export interface RelState {
  problem: RelProblem;
  title: string;
  preset: RelPresetKey | 'custom';
  show: 'v' | 'a';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: RelProblem;
  title: string;
  preset: RelState['preset'];
}
const copy = (p: RelProblem): RelProblem => structuredClone(p);

export function parseRel(raw: unknown): { ok: true; problem: RelProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !['rot', 'trans'].includes(raw.carrier as string) || !['xyz', 'line', 'circle'].includes(raw.path as string) || !isNum(raw.t)) return { ok: false, errors: ['В файле нет задачи (problem с полями carrier, path, t…).'] };
  const p: RelProblem = structuredClone(REL0);
  for (const k of REL_STR) if (typeof raw[k] === 'string') p[k] = (raw[k] as string).slice(0, 200);
  p.carrier = raw.carrier as RelProblem['carrier'];
  p.path = raw.path as RelProblem['path'];
  if (['xy', 'xz', 'yz'].includes(raw.plane as string)) p.plane = raw.plane as Plane;
  if (raw.law === 'theta') p.law = 'theta';
  if (Array.isArray(raw.p0)) p.p0 = [0, 1, 2].map((i) => (typeof (raw.p0 as unknown[])[i] === 'string' ? ((raw.p0 as string[])[i]).slice(0, 60) : '0')) as [string, string, string];
  p.t = raw.t as number;
  return { ok: true, problem: p };
}

export class RelStore {
  private st: RelState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: RelPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'r2327';
    this.st = { problem: copy(REL_PRESETS[k].problem as RelProblem), title: REL_PRESETS[k].title, preset: k, show: 'a', canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): RelState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<RelState>) {
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
  private edit(fn: (p: RelProblem) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  private change(fn: (p: RelProblem) => void) {
    this.commit();
    this.edit(fn);
  }
  loadPreset = (k: RelPresetKey) => {
    this.commit();
    this.set({ problem: copy(REL_PRESETS[k].problem as RelProblem), title: REL_PRESETS[k].title, preset: k });
  };
  setShow = (show: 'v' | 'a') => this.set({ show });
  typeStr = (k: RelStrKey, s: string) => {
    this.touch(`s:${k}`);
    this.edit((p) => (p[k] = s.slice(0, 200)));
  };
  typeP0 = (i: number, s: string) => {
    this.touch(`p0:${i}`);
    this.edit((p) => (p.p0[i] = s.slice(0, 60)));
  };
  typeT = (t: number) => {
    this.touch('t');
    this.edit((p) => (p.t = t));
  };
  setCarrier = (c: RelProblem['carrier']) => c !== this.st.problem.carrier && this.change((p) => (p.carrier = c));
  setPath = (c: RelProblem['path']) => c !== this.st.problem.path && this.change((p) => (p.path = c));
  setPlane = (c: Plane) => c !== this.st.problem.plane && this.change((p) => (p.plane = c));
  setLaw = (c: RelProblem['law']) => c !== this.st.problem.law && this.change((p) => (p.law = c));
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
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(REL_MODULE, this.st.title, { problem: this.st.problem }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== REL_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseRel(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Сложное движение точки';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
