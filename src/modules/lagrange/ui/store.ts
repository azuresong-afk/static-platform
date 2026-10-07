/** Состояние вкладки «Уравнения Лагранжа»: задача, история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { LagCoord, LagParam, LagProblem } from '../model/lagrange';
import { LAGRANGE_PRESETS, type LagrangePresetKey } from '../presets';

export const LAGRANGE_MODULE = 'lagrange';
const MAX_COORDS = 3,
  MAX_PARAMS = 12;

export interface LagrangeState {
  problem: LagProblem;
  title: string;
  preset: LagrangePresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: LagProblem;
  title: string;
  preset: LagrangeState['preset'];
}

const isStr = (x: unknown): x is string => typeof x === 'string';

export function parseProblem(raw: unknown): { ok: true; problem: LagProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw)) return { ok: false, errors: ['В файле нет задачи (problem).'] };
  const errors: string[] = [];
  const coords: LagCoord[] = [];
  if (!Array.isArray(raw.coords) || !raw.coords.length || raw.coords.length > MAX_COORDS) errors.push(`Координат должно быть от 1 до ${MAX_COORDS}.`);
  else
    raw.coords.forEach((c: unknown, i: number) => {
      if (!isObj(c) || !isStr(c.name) || !isNum(c.q0) || !isNum(c.v0) || !isNum(c.eq) || !isStr(c.Q)) errors.push(`Координата №${i + 1}: имя, q0, v0, eq — числа, Q — формула.`);
      else coords.push({ name: c.name, q0: c.q0, v0: c.v0, eq: c.eq, Q: c.Q });
    });
  const params: LagParam[] = [];
  if (!Array.isArray(raw.params) || raw.params.length > MAX_PARAMS) errors.push(`Параметров — не больше ${MAX_PARAMS}.`);
  else
    raw.params.forEach((p: unknown, i: number) => {
      if (!isObj(p) || !isStr(p.name) || !isNum(p.value)) errors.push(`Параметр №${i + 1}: имя и числовое значение.`);
      else params.push({ name: p.name, value: p.value });
    });
  if (!isStr(raw.T) || !isStr(raw.P)) errors.push('T и Π — формулы (строки).');
  if (!isNum(raw.tEnd) || raw.tEnd < 0) errors.push('Время интегрирования — неотрицательное число.');
  if (errors.length) return { ok: false, errors };
  return { ok: true, problem: { coords, params, T: raw.T as string, P: raw.P as string, tEnd: raw.tEnd as number } };
}

export class LagrangeStore {
  private st: LagrangeState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: LagrangePresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm4837';
    this.st = { problem: structuredClone(LAGRANGE_PRESETS[k].problem), title: LAGRANGE_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): LagrangeState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<LagrangeState>) {
    this.st = { ...this.st, ...patch, canUndo: this.hist.canUndo, canRedo: this.hist.canRedo };
    this.listeners.forEach((f) => f());
  }
  private snap = (): Snap => ({ problem: this.st.problem, title: this.st.title, preset: this.st.preset });
  private commit() {
    this.hist.push(this.snap());
    if (this.st.preset !== 'custom') this.st = { ...this.st, preset: 'custom', title: 'Своя система' };
  }
  private touch(key: string) {
    if (this.hist.startSession(key)) this.commit();
  }
  endSession = (key: string) => this.hist.endSession(key);
  private setProblem(problem: LagProblem) {
    this.set({ problem });
  }
  loadPreset = (k: LagrangePresetKey) => {
    this.commit();
    this.set({ problem: structuredClone(LAGRANGE_PRESETS[k].problem), title: LAGRANGE_PRESETS[k].title, preset: k });
  };
  typeText = (key: 'T' | 'P', v: string) => {
    this.touch(key);
    this.setProblem({ ...this.st.problem, [key]: v });
  };
  typeTime = (v: number) => {
    this.touch('tEnd');
    this.setProblem({ ...this.st.problem, tEnd: v });
  };
  typeCoord = <K extends keyof LagCoord>(i: number, key: K, v: LagCoord[K]) => {
    this.touch(`coord:${i}:${key}`);
    this.setProblem({ ...this.st.problem, coords: this.st.problem.coords.map((c, j) => (j === i ? { ...c, [key]: v } : c)) });
  };
  typeParam = <K extends keyof LagParam>(i: number, key: K, v: LagParam[K]) => {
    this.touch(`param:${i}:${key}`);
    this.setProblem({ ...this.st.problem, params: this.st.problem.params.map((c, j) => (j === i ? { ...c, [key]: v } : c)) });
  };
  addCoord = () => {
    const p = this.st.problem;
    if (p.coords.length >= MAX_COORDS) return;
    this.commit();
    const used = new Set([...p.coords.map((c) => c.name), ...p.params.map((c) => c.name)]);
    const name = ['q', 'ψ', 'y', 'z', 's', 'θ'].find((n) => !used.has(n)) ?? 'q' + (p.coords.length + 1);
    this.setProblem({ ...p, coords: [...p.coords, { name, q0: 0, v0: 0, eq: 0, Q: '' }] });
  };
  removeCoord = (i: number) => {
    const p = this.st.problem;
    if (p.coords.length <= 1) return;
    this.commit();
    this.setProblem({ ...p, coords: p.coords.filter((_, j) => j !== i) });
  };
  addParam = () => {
    const p = this.st.problem;
    if (p.params.length >= MAX_PARAMS) return;
    this.commit();
    const used = new Set([...p.coords.map((c) => c.name), ...p.params.map((c) => c.name)]);
    const name = ['k', 'c', 'b', 'R', 'J', 'a', 'h', 'F'].find((n) => !used.has(n)) ?? 'p' + (p.params.length + 1);
    this.setProblem({ ...p, params: [...p.params, { name, value: 1 }] });
  };
  removeParam = (i: number) => {
    this.commit();
    this.setProblem({ ...this.st.problem, params: this.st.problem.params.filter((_, j) => j !== i) });
  };
  undo = () => {
    const prev = this.hist.undo(this.snap());
    if (prev) this.set(prev);
  };
  redo = () => {
    const next = this.hist.redo(this.snap());
    if (next) this.set(next);
  };
  notify = (text: string, tone: 'ok' | 'bad' = 'ok') => this.set({ notice: { text, tone, seq: (this.st.notice?.seq ?? 0) + 1 } });
  closeNotice = () => this.set({ notice: null });
  setExplain = (explain: boolean) => this.set({ explain });
  projectTitle = () => this.st.title;
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(LAGRANGE_MODULE, this.st.title, { problem: this.st.problem }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== LAGRANGE_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseProblem(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Уравнения Лагранжа';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
