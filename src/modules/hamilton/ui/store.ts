/** Состояние вкладки «Устойчивость и нелинейные колебания»: режим, задачи режимов, история отмены, файл проекта. */
import type { ExtraProblem } from '../../../shared/extra';
import { extraHost, readExtraView, type XView } from '../../../shared/extraHost';
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { LagCoord, LagParam, LagProblem } from '../../lagrange/model/lagrange';
import { parseProblem as parseRouth } from '../../lagrange/ui/store';
import type { StringBC, StringProblem } from '../model/jacobi';
import type { LetCoord, LetProblem } from '../model/letters';
import type { NonlinProblem } from '../model/nonlin';
import type { RollMotion, RollProblem } from '../model/roll';
import type { StabForm, StabProblem } from '../model/stability';
import { HAM_ASKS } from '../model/extra';
import { HAM_EXTRA_PRESETS, type HamExtraKey } from '../extraPresets';
import { defaultProblem, defJacobi, defLetters, defRoll, HAM_PRESETS, type HamMode, type HamPresetKey, type HamProblem, type JacProblem } from '../presets';

export const HAM_MODULE = 'hamilton';
const MAX_PARAMS = 12;
const MAX_STARTS = 6;

export interface HamState {
  problem: HamProblem;
  /** Второй экран (пункт 31): связи, направляющая, волчки, упоры, субгармоники, точечное преобразование. */
  extra: ExtraProblem;
  view: XView;
  title: string;
  preset: HamPresetKey | HamExtraKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: HamProblem;
  extra: ExtraProblem;
  view: XView;
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
const range = (x: unknown): { from: number; to: number } | null | undefined =>
  x == null ? null : isObj(x) && isNum(x.from) && isNum(x.to) && x.to > x.from ? { from: x.from, to: x.to } : undefined;
function parseLetters(raw: unknown): LetProblem | null {
  if (raw == null) return defLetters();
  if (!isObj(raw) || !Array.isArray(raw.coords) || raw.coords.length < 1 || raw.coords.length > 3) return null;
  const coords: LetCoord[] = [];
  for (const c of raw.coords) {
    if (!isObj(c) || !isStr(c.name) || !isStr(c.at) || !isStr(c.Q) || !isNum(c.dq0) || !isNum(c.dv0)) return null;
    coords.push({ name: c.name.slice(0, 20), at: c.at.slice(0, 200), Q: c.Q.slice(0, 200), dq0: c.dq0, dv0: c.dv0 });
  }
  const params = parseParams(raw.params);
  const sc = range(raw.scan);
  if (!params || !isStr(raw.T) || !isStr(raw.P) || !isStr(raw.unknown) || typeof raw.indifferent !== 'boolean' || !isStr(raw.cond) || sc === undefined)
    return null;
  return {
    coords,
    params,
    T: raw.T.slice(0, 600),
    P: raw.P.slice(0, 600),
    unknown: raw.unknown.slice(0, 20),
    indifferent: raw.indifferent,
    cond: raw.cond.slice(0, 20),
    scan: sc,
  };
}
function parseRoll(raw: unknown): RollProblem | null {
  if (raw == null) return defRoll();
  if (!isObj(raw)) return null;
  const params = parseParams(raw.params);
  const sc = range(raw.scan);
  const strs = ['m', 'a', 'A', 'C', 'w', 'cond'] as const;
  if (!params || strs.some((k) => !isStr(raw[k])) || !['line', 'spin'].includes(raw.motion as string) || sc === undefined) return null;
  if (!isNum(raw.th0) || !isNum(raw.tEnd) || raw.tEnd < 0) return null;
  return {
    params,
    m: (raw.m as string).slice(0, 200),
    a: (raw.a as string).slice(0, 200),
    A: (raw.A as string).slice(0, 200),
    C: (raw.C as string).slice(0, 200),
    motion: raw.motion as RollMotion,
    w: (raw.w as string).slice(0, 200),
    cond: (raw.cond as string).slice(0, 20),
    scan: sc,
    th0: raw.th0,
    tEnd: raw.tEnd,
  };
}
function parseJacobi(raw: unknown): JacProblem | null {
  if (raw == null) return defJacobi();
  if (!isObj(raw) || !['hj', 'string'].includes(raw.form as string)) return null;
  const h = parseRouth(raw.hj);
  if (!h.ok) return null;
  const st = raw.str;
  if (!isObj(st) || !isStr(st.rho) || !isStr(st.T) || !isStr(st.l) || !['fixed', 'free'].includes(st.bc as string) || !isNum(st.modes)) return null;
  const params = parseParams(st.params);
  if (!params) return null;
  const str: StringProblem = {
    params,
    rho: st.rho.slice(0, 200),
    T: st.T.slice(0, 200),
    l: st.l.slice(0, 200),
    bc: st.bc as StringBC,
    modes: Math.max(1, Math.min(6, Math.round(st.modes))),
  };
  return { form: raw.form as JacProblem['form'], hj: h.problem, str };
}
const MODES_ALL: HamMode[] = ['routh', 'stab', 'nonlin', 'letters', 'roll', 'jacobi'];
export function parseProblem(raw: unknown): { ok: true; problem: HamProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !MODES_ALL.includes(raw.mode as HamMode)) return { ok: false, errors: ['В файле нет задачи (problem.mode).'] };
  const r = parseRouth(raw.routh);
  if (!r.ok) return { ok: false, errors: r.errors };
  const s = parseStab(raw.stab);
  if (!s) return { ok: false, errors: ['Устойчивость: неверные данные (форма, коэффициенты, матрицы).'] };
  const n = parseNonlin(raw.nonlin);
  if (!n) return { ok: false, errors: ['Нелинейные колебания: неверные данные.'] };
  const l = parseLetters(raw.letters);
  if (!l) return { ok: false, errors: ['В буквах: неверные данные.'] };
  const ro = parseRoll(raw.roll);
  if (!ro) return { ok: false, errors: ['Катящийся диск: неверные данные.'] };
  const j = parseJacobi(raw.jacobi);
  if (!j) return { ok: false, errors: ['Якоби — Гамильтон, струна: неверные данные.'] };
  return { ok: true, problem: { mode: raw.mode as HamMode, routh: r.problem, stab: s, nonlin: n, letters: l, roll: ro, jacobi: j } };
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
      extra: structuredClone(HAM_EXTRA_PRESETS.x5519.problem),
      view: 'main',
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
  private snap = (): Snap => ({ problem: this.st.problem, extra: this.st.extra, view: this.st.view, title: this.st.title, preset: this.st.preset });
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
  loadPreset = (k: HamPresetKey | HamExtraKey) => {
    this.commit();
    if (k in HAM_EXTRA_PRESETS) {
      const e = HAM_EXTRA_PRESETS[k as HamExtraKey];
      return this.set({ extra: structuredClone(e.problem), view: 'extra', title: e.title, preset: k });
    }
    const p = HAM_PRESETS[k as HamPresetKey];
    this.set({ problem: structuredClone(p.problem), view: 'main', title: p.title, preset: k });
  };
  xhost = extraHost(HAM_ASKS, this, { commit: () => this.commit(), touch: (k) => this.touch(k), patch: (p) => this.set(p) });
  setMode = (mode: HamMode) => {
    if (mode === this.st.problem.mode) return;
    this.commit();
    this.put({ mode });
  };

  /* Интегралы, Раус, Гамильтон (и та же система для уравнения Якоби — Гамильтона). */
  private get sys(): LagProblem {
    const p = this.st.problem;
    return p.mode === 'jacobi' ? p.jacobi.hj : p.routh;
  }
  private setRouth(r: LagProblem) {
    const p = this.st.problem;
    if (p.mode === 'jacobi') this.put({ jacobi: { ...p.jacobi, hj: r } });
    else this.put({ routh: r });
  }
  typeRouthText = (key: 'T' | 'P', v: string) => {
    this.touch('r:' + key);
    this.setRouth({ ...this.sys, [key]: v });
  };
  typeRouthTime = (v: number) => {
    this.touch('r:tEnd');
    this.setRouth({ ...this.sys, tEnd: v });
  };
  typeCoord = <K extends keyof LagCoord>(i: number, key: K, v: LagCoord[K]) => {
    this.touch(`r:coord:${i}:${key}`);
    const r = this.sys;
    this.setRouth({ ...r, coords: r.coords.map((c, j) => (j === i ? { ...c, [key]: v } : c)) });
  };
  addCoord = () => {
    const r = this.sys;
    if (r.coords.length >= 3) return;
    this.commit();
    const used = new Set([...r.coords.map((c) => c.name), ...r.params.map((c) => c.name)]);
    const name = ['ψ', 'φ', 'θ', 'x', 'y', 'z'].find((n) => !used.has(n)) ?? 'q' + (r.coords.length + 1);
    this.setRouth({ ...r, coords: [...r.coords, { name, q0: 0, v0: 0, eq: 0, Q: '' }] });
  };
  removeCoord = (i: number) => {
    const r = this.sys;
    if (r.coords.length <= 1) return;
    this.commit();
    this.setRouth({ ...r, coords: r.coords.filter((_, j) => j !== i) });
  };

  /* Параметры — свои у каждого режима. */
  private paramsOf = (): LagParam[] => {
    const p = this.st.problem;
    switch (p.mode) {
      case 'routh':
        return p.routh.params;
      case 'stab':
        return p.stab.params;
      case 'nonlin':
        return p.nonlin.params;
      case 'letters':
        return p.letters.params;
      case 'roll':
        return p.roll.params;
      case 'jacobi':
        return p.jacobi.form === 'hj' ? p.jacobi.hj.params : p.jacobi.str.params;
    }
  };
  private setParams(params: LagParam[]) {
    const p = this.st.problem;
    if (p.mode === 'routh') this.put({ routh: { ...p.routh, params } });
    else if (p.mode === 'stab') this.put({ stab: { ...p.stab, params } });
    else if (p.mode === 'nonlin') this.put({ nonlin: { ...p.nonlin, params } });
    else if (p.mode === 'letters') this.put({ letters: { ...p.letters, params } });
    else if (p.mode === 'roll') this.put({ roll: { ...p.roll, params } });
    else if (p.jacobi.form === 'hj') this.put({ jacobi: { ...p.jacobi, hj: { ...p.jacobi.hj, params } } });
    else this.put({ jacobi: { ...p.jacobi, str: { ...p.jacobi.str, params } } });
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

  /* В буквах. */
  private setLet(l: LetProblem) {
    this.put({ letters: l });
  }
  typeLetText = (key: 'T' | 'P', v: string) => {
    this.touch('l:' + key);
    this.setLet({ ...this.st.problem.letters, [key]: v });
  };
  typeLetCoord = <K extends keyof LetCoord>(i: number, key: K, v: LetCoord[K]) => {
    this.touch(`l:coord:${i}:${key}`);
    const l = this.st.problem.letters;
    this.setLet({ ...l, coords: l.coords.map((c, j) => (j === i ? { ...c, [key]: v } : c)) });
  };
  addLetCoord = () => {
    const l = this.st.problem.letters;
    if (l.coords.length >= 3) return;
    this.commit();
    const used = new Set([...l.coords.map((c) => c.name), ...l.params.map((c) => c.name)]);
    const name = ['ψ', 'φ', 'θ', 'x', 'y', 'z'].find((n) => !used.has(n)) ?? 'q' + (l.coords.length + 1);
    this.setLet({ ...l, coords: [...l.coords, { name, at: '0', Q: '', dq0: 0, dv0: 0 }] });
  };
  removeLetCoord = (i: number) => {
    const l = this.st.problem.letters;
    if (l.coords.length <= 1) return;
    this.commit();
    this.setLet({ ...l, coords: l.coords.filter((_, j) => j !== i) });
  };
  setLetChoice = (key: 'unknown' | 'cond', v: string) => {
    const l = this.st.problem.letters;
    if (l[key] === v) return;
    this.commit();
    this.setLet({ ...l, [key]: v, ...(key === 'cond' && !v ? { scan: null } : {}) });
  };
  setIndifferent = (on: boolean) => {
    const l = this.st.problem.letters;
    if (l.indifferent === on) return;
    this.commit();
    this.setLet({ ...l, indifferent: on });
  };
  /** Перебор параметра (в буквах и для диска). */
  setRange = (on: boolean) => {
    const p = this.st.problem;
    const cur = p.mode === 'roll' ? p.roll.scan : p.letters.scan;
    if (on === !!cur) return;
    this.commit();
    const v = on ? { from: 0, to: 5 } : null;
    if (p.mode === 'roll') this.put({ roll: { ...p.roll, scan: v } });
    else this.setLet({ ...p.letters, scan: v });
  };
  typeRange = (key: 'from' | 'to', v: number) => {
    const p = this.st.problem;
    this.touch('range:' + key);
    if (p.mode === 'roll') {
      if (p.roll.scan) this.put({ roll: { ...p.roll, scan: { ...p.roll.scan, [key]: v } } });
    } else if (p.letters.scan) this.setLet({ ...p.letters, scan: { ...p.letters.scan, [key]: v } });
  };

  /* Катящийся диск. */
  typeRoll = <K extends 'm' | 'a' | 'A' | 'C' | 'w' | 'th0' | 'tEnd'>(key: K, v: RollProblem[K]) => {
    this.touch('o:' + key);
    this.put({ roll: { ...this.st.problem.roll, [key]: v } });
  };
  setRollChoice = <K extends 'motion' | 'cond'>(key: K, v: RollProblem[K]) => {
    const r = this.st.problem.roll;
    if (r[key] === v) return;
    this.commit();
    this.put({ roll: { ...r, [key]: v, ...(key === 'cond' && !v ? { scan: null } : {}) } });
  };

  /* Якоби — Гамильтон, струна. */
  setJacForm = (form: JacProblem['form']) => {
    const j = this.st.problem.jacobi;
    if (j.form === form) return;
    this.commit();
    this.put({ jacobi: { ...j, form } });
  };
  typeStr = <K extends 'rho' | 'T' | 'l' | 'modes'>(key: K, v: StringProblem[K]) => {
    this.touch('j:' + key);
    const j = this.st.problem.jacobi;
    this.put({ jacobi: { ...j, str: { ...j.str, [key]: v } } });
  };
  setStrBC = (bc: StringBC) => {
    const j = this.st.problem.jacobi;
    if (j.str.bc === bc) return;
    this.commit();
    this.put({ jacobi: { ...j, str: { ...j.str, bc } } });
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
    text: writeEnvelope(HAM_MODULE, this.st.title, { problem: this.st.problem, extra: this.st.extra, view: this.st.view }, now),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== HAM_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseProblem(env.raw.problem);
    const x = readExtraView(env.raw, HAM_ASKS, r.ok);
    if (!x.usable) return (this.notify(head + (r.ok ? '' : r.errors.slice(0, 4).join(' ')), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Устойчивость и нелинейные колебания';
    this.set({ problem: r.ok ? r.problem : this.st.problem, extra: x.extra ?? this.st.extra, view: x.view, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}

export { defaultProblem };
