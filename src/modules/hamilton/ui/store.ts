/** Состояние вкладки «Устойчивость и нелинейные колебания»: режим, задачи режимов, история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { LagCoord, LagParam, LagProblem } from '../../lagrange/model/lagrange';
import { parseProblem as parseRouth } from '../../lagrange/ui/store';
import type { NonlinProblem } from '../model/nonlin';
import type { StabForm, StabProblem } from '../model/stability';
import { defaultProblem, HAM_PRESETS, type HamMode, type HamPresetKey, type HamProblem } from '../presets';

export const HAM_MODULE = 'hamilton';
const MAX_PARAMS = 12;
const MAX_STARTS = 6;

export interface HamState {
  problem: HamProblem;
  title: string;
  preset: HamPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: HamProblem;
  title: string;
  preset: HamState['preset'];
}
const isStr = (x: unknown): x is string => typeof x === 'string';
const strGrid = (g: unknown, n: number): string[][] | null =>
  Array.isArray(g) && g.length === n && g.every((r) => Array.isArray(r) && r.length === n && r.every(isStr))
    ? (g as string[][]).map((r) => r.map((s) => s.slice(0, 200)))
    : null;
function parseParams(raw: unknown): LagParam[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_PARAMS) return null;
  const out: LagParam[] = [];
  for (const p of raw) {
    if (!isObj(p) || !isStr(p.name) || !isNum(p.value)) return null;
    out.push({ name: p.name.slice(0, 20), value: p.value });
  }
  return out;
}
function parseStab(raw: unknown): StabProblem | null {
  if (!isObj(raw) || !['poly', 'first', 'second'].includes(raw.form as string)) return null;
  const params = parseParams(raw.params);
  if (!params || !Array.isArray(raw.poly) || raw.poly.length < 2 || raw.poly.length > 7 || !raw.poly.every(isStr)) return null;
  const nA = Array.isArray(raw.A) ? raw.A.length : 0,
    nM = Array.isArray(raw.M) ? raw.M.length : 0;
  if (nA < 1 || nA > 4 || nM < 1 || nM > 3) return null;
  const A = strGrid(raw.A, nA),
    M = strGrid(raw.M, nM),
    B = strGrid(raw.B, nM),
    C = strGrid(raw.C, nM);
  if (!A || !M || !B || !C) return null;
  const sc = raw.scan;
  if (sc != null && !(isObj(sc) && isStr(sc.param) && isNum(sc.from) && isNum(sc.to) && sc.to > sc.from)) return null;
  return {
    form: raw.form as StabForm,
    poly: (raw.poly as string[]).map((s) => s.slice(0, 200)),
    A,
    M,
    B,
    C,
    params,
    scan: isObj(sc) ? { param: sc.param as string, from: sc.from as number, to: sc.to as number } : null,
  };
}
function parseNonlin(raw: unknown): NonlinProblem | null {
  if (!isObj(raw) || !isStr(raw.name) || !isStr(raw.f) || !isStr(raw.k2)) return null;
  const params = parseParams(raw.params);
  if (!params || !isNum(raw.x0) || !isNum(raw.v0) || !isNum(raw.tEnd) || raw.tEnd < 0 || !isNum(raw.aMax) || raw.aMax < 0) return null;
  if (!Array.isArray(raw.starts) || raw.starts.length > MAX_STARTS || !raw.starts.every(isNum)) return null;
  return {
    name: raw.name.slice(0, 20),
    params,
    f: raw.f.slice(0, 400),
    k2: raw.k2.slice(0, 200),
    x0: raw.x0,
    v0: raw.v0,
    tEnd: raw.tEnd,
    starts: raw.starts as number[],
    aMax: raw.aMax,
  };
}
export function parseProblem(raw: unknown): { ok: true; problem: HamProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !['routh', 'stab', 'nonlin'].includes(raw.mode as string)) return { ok: false, errors: ['В файле нет задачи (problem.mode).'] };
  const r = parseRouth(raw.routh);
  if (!r.ok) return { ok: false, errors: r.errors };
  const s = parseStab(raw.stab);
  if (!s) return { ok: false, errors: ['Устойчивость: неверные данные (форма, коэффициенты, матрицы).'] };
  const n = parseNonlin(raw.nonlin);
  if (!n) return { ok: false, errors: ['Нелинейные колебания: неверные данные.'] };
  return { ok: true, problem: { mode: raw.mode as HamMode, routh: r.problem, stab: s, nonlin: n } };
}

const resize = (g: string[][], n: number, diag: string): string[][] =>
  Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => g[i]?.[j] ?? (i === j ? diag : '0')));

export class HamStore {
  private st: HamState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: HamPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm5524';
    this.st = {
      problem: structuredClone(HAM_PRESETS[k].problem),
      title: HAM_PRESETS[k].title,
      preset: k,
      canUndo: false,
      canRedo: false,
      notice: null,
      explain: opts.explain ?? true,
    };
  }
  get = (): HamState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<HamState>) {
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
  private put(p: Partial<HamProblem>) {
    this.set({ problem: { ...this.st.problem, ...p } });
  }
  loadPreset = (k: HamPresetKey) => {
    this.commit();
    this.set({ problem: structuredClone(HAM_PRESETS[k].problem), title: HAM_PRESETS[k].title, preset: k });
  };
  setMode = (mode: HamMode) => {
    if (mode === this.st.problem.mode) return;
    this.commit();
    this.put({ mode });
  };

  /* Интегралы, Раус, Гамильтон. */
  private setRouth(r: LagProblem) {
    this.put({ routh: r });
  }
  typeRouthText = (key: 'T' | 'P', v: string) => {
    this.touch('r:' + key);
    this.setRouth({ ...this.st.problem.routh, [key]: v });
  };
  typeRouthTime = (v: number) => {
    this.touch('r:tEnd');
    this.setRouth({ ...this.st.problem.routh, tEnd: v });
  };
  typeCoord = <K extends keyof LagCoord>(i: number, key: K, v: LagCoord[K]) => {
    this.touch(`r:coord:${i}:${key}`);
    const r = this.st.problem.routh;
    this.setRouth({ ...r, coords: r.coords.map((c, j) => (j === i ? { ...c, [key]: v } : c)) });
  };
  addCoord = () => {
    const r = this.st.problem.routh;
    if (r.coords.length >= 3) return;
    this.commit();
    const used = new Set([...r.coords.map((c) => c.name), ...r.params.map((c) => c.name)]);
    const name = ['ψ', 'φ', 'θ', 'x', 'y', 'z'].find((n) => !used.has(n)) ?? 'q' + (r.coords.length + 1);
    this.setRouth({ ...r, coords: [...r.coords, { name, q0: 0, v0: 0, eq: 0, Q: '' }] });
  };
  removeCoord = (i: number) => {
    const r = this.st.problem.routh;
    if (r.coords.length <= 1) return;
    this.commit();
    this.setRouth({ ...r, coords: r.coords.filter((_, j) => j !== i) });
  };

  /* Параметры — свои у каждого режима. */
  private paramsOf = (): LagParam[] => {
    const p = this.st.problem;
    return p.mode === 'routh' ? p.routh.params : p.mode === 'stab' ? p.stab.params : p.nonlin.params;
  };
  private setParams(params: LagParam[]) {
    const p = this.st.problem;
    if (p.mode === 'routh') this.put({ routh: { ...p.routh, params } });
    else if (p.mode === 'stab') this.put({ stab: { ...p.stab, params } });
    else this.put({ nonlin: { ...p.nonlin, params } });
  }
  typeParam = <K extends keyof LagParam>(i: number, key: K, v: LagParam[K]) => {
    this.touch(`param:${i}:${key}`);
    this.setParams(this.paramsOf().map((c, j) => (j === i ? { ...c, [key]: v } : c)));
  };
  addParam = () => {
    const ps = this.paramsOf();
    if (ps.length >= MAX_PARAMS) return;
    this.commit();
    const used = new Set(ps.map((c) => c.name));
    const name = ['k', 'c', 'b', 'm', 'a', 'h', 'μ', 'β'].find((n) => !used.has(n)) ?? 'p' + (ps.length + 1);
    this.setParams([...ps, { name, value: 1 }]);
  };
  removeParam = (i: number) => {
    this.commit();
    this.setParams(this.paramsOf().filter((_, j) => j !== i));
  };

  /* Устойчивость. */
  private setStab(s: StabProblem) {
    this.put({ stab: s });
  }
  setForm = (form: StabForm) => {
    if (form === this.st.problem.stab.form) return;
    this.commit();
    this.setStab({ ...this.st.problem.stab, form });
  };
  /** Порядок: степень уравнения (poly), порядок матрицы (first), число координат (second). */
  setOrder = (n: number) => {
    const s = this.st.problem.stab;
    this.commit();
    if (s.form === 'poly') this.setStab({ ...s, poly: Array.from({ length: n + 1 }, (_, i) => s.poly[i] ?? '1') });
    else if (s.form === 'first') this.setStab({ ...s, A: resize(s.A, n, '0') });
    else this.setStab({ ...s, M: resize(s.M, n, '1'), B: resize(s.B, n, '0'), C: resize(s.C, n, '1') });
  };
  typePoly = (i: number, v: string) => {
    this.touch(`s:poly:${i}`);
    const s = this.st.problem.stab;
    this.setStab({ ...s, poly: s.poly.map((x, j) => (j === i ? v : x)) });
  };
  typeCell = (key: 'A' | 'M' | 'B' | 'C', i: number, j: number, v: string) => {
    this.touch(`s:${key}:${i}:${j}`);
    const s = this.st.problem.stab;
    this.setStab({ ...s, [key]: s[key].map((r, a) => (a === i ? r.map((x, b) => (b === j ? v : x)) : r)) });
  };
  setScan = (on: boolean) => {
    const s = this.st.problem.stab;
    if (on === !!s.scan) return;
    this.commit();
    this.setStab({ ...s, scan: on ? { param: s.params[0]?.name ?? 'k', from: 0, to: 10 } : null });
  };
  typeScan = <K extends 'param' | 'from' | 'to'>(key: K, v: K extends 'param' ? string : number) => {
    const s = this.st.problem.stab;
    if (!s.scan) return;
    this.touch(`s:scan:${key}`);
    this.setStab({ ...s, scan: { ...s.scan, [key]: v } });
  };

  /* Нелинейные колебания. */
  typeNonlin = <K extends 'name' | 'f' | 'k2' | 'x0' | 'v0' | 'tEnd' | 'aMax'>(key: K, v: NonlinProblem[K]) => {
    this.touch(`n:${key}`);
    this.put({ nonlin: { ...this.st.problem.nonlin, [key]: v } });
  };
  typeStart = (i: number, v: number) => {
    this.touch(`n:start:${i}`);
    const n = this.st.problem.nonlin;
    this.put({ nonlin: { ...n, starts: n.starts.map((x, j) => (j === i ? v : x)) } });
  };
  addStart = () => {
    const n = this.st.problem.nonlin;
    if (n.starts.length >= MAX_STARTS) return;
    this.commit();
    this.put({ nonlin: { ...n, starts: [...n.starts, (n.starts[n.starts.length - 1] ?? n.x0) * 1.5 || 1] } });
  };
  removeStart = (i: number) => {
    this.commit();
    const n = this.st.problem.nonlin;
    this.put({ nonlin: { ...n, starts: n.starts.filter((_, j) => j !== i) } });
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
  exportProject = (now = new Date()) => ({
    name: projectFileName(this.st.title, now),
    text: writeEnvelope(HAM_MODULE, this.st.title, { problem: this.st.problem }, now),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== HAM_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseProblem(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Устойчивость и нелинейные колебания';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}

export { defaultProblem };
