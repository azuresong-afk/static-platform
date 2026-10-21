/** Состояние вкладки «Реакции при плоском движении»: тело, точки, связи, нагрузки, скорости; история отмены, файл проекта. */
import type { ExtraProblem } from '../../../shared/extra';
import { extraHost, readExtraView, type XView } from '../../../shared/extraHost';
import { BODY_ASKS } from '../model/extra';
import { BODY_EXTRA_PRESETS, type BodyExtraKey } from '../extraPresets';
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { BodyPoint, BodyProblem, Constr, ConstrKind, Load, Shape } from '../model/body';
import { BODY_PRESETS, type BodyPresetKey } from '../presets';

export const BODY_MODULE = 'planebody';
const MAX = 8;
export const BODY_NUM = ['m', 'g', 'L', 'theta', 'R', 'a', 'b', 'rho', 'J', 'omega', 'vx', 'vy', 'ax', 'ay', 'eps'] as const;
export type BodyNumKey = (typeof BODY_NUM)[number];
export const CONSTR_NUM = ['ang', 'f', 'qx', 'qy'] as const;
export type ConstrNumKey = (typeof CONSTR_NUM)[number];
export const LOAD_NUM = ['fx', 'fy', 'm'] as const;
export type LoadNumKey = (typeof LOAD_NUM)[number];
const SHAPES: Shape[] = ['rod', 'disk', 'ring', 'rect', 'rho', 'J'];
const KINDS: ConstrKind[] = ['pin', 'roller', 'rope', 'unwind', 'roll'];

export interface BodyState {
  problem: BodyProblem;
  extra: ExtraProblem;
  view: XView;
  title: string;
  preset: BodyPresetKey | BodyExtraKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: BodyProblem;
  extra: ExtraProblem;
  view: XView;
  title: string;
  preset: BodyState['preset'];
}
const copy = (p: BodyProblem): BodyProblem => structuredClone(p);
const name = (s: unknown) => (typeof s === 'string' ? s.slice(0, 12) : '');

export function parseBody(raw: unknown): { ok: true; problem: BodyProblem } | { ok: false; errors: string[] } {
  if (
    !isObj(raw) ||
    !BODY_NUM.every((k) => isNum(raw[k])) ||
    !SHAPES.includes(raw.shape as Shape) ||
    !['dyn', 'given'].includes(raw.mode as string) ||
    ![raw.points, raw.constr, raw.loads].every(Array.isArray)
  )
    return { ok: false, errors: ['В файле нет задачи (problem с полями shape, mode, points, constr, loads и размерами тела).'] };
  const points: BodyPoint[] = [];
  for (const p of raw.points as unknown[]) {
    if (!isObj(p) || !isNum(p.x) || !isNum(p.y)) return { ok: false, errors: ['Точка тела: имя и числа x, y.'] };
    points.push({ name: name(p.name), x: p.x, y: p.y });
  }
  const constr: Constr[] = [];
  for (const c of raw.constr as unknown[]) {
    if (!isObj(c) || !KINDS.includes(c.kind as ConstrKind) || !CONSTR_NUM.every((k) => isNum(c[k])))
      return { ok: false, errors: ['Связь: вид (pin, roller, rope, unwind, roll), точка и числа ang, f, qx, qy.'] };
    constr.push({
      kind: c.kind as ConstrKind,
      at: name(c.at),
      ang: c.ang as number,
      one: c.one !== false,
      f: c.f as number,
      qx: c.qx as number,
      qy: c.qy as number,
    });
  }
  const loads: Load[] = [];
  for (const l of raw.loads as unknown[]) {
    if (!isObj(l) || !['force', 'moment'].includes(l.kind as string) || !LOAD_NUM.every((k) => isNum(l[k])))
      return { ok: false, errors: ['Нагрузка: сила (force) или пара (moment) и числа fx, fy, m.'] };
    loads.push({ kind: l.kind as Load['kind'], at: name(l.at), fx: l.fx as number, fy: l.fy as number, m: l.m as number });
  }
  if (points.length > MAX || constr.length > MAX || loads.length > MAX) return { ok: false, errors: [`Не больше ${MAX} точек, связей и нагрузок.`] };
  const nums = Object.fromEntries(BODY_NUM.map((k) => [k, raw[k]])) as Record<BodyNumKey, number>;
  return {
    ok: true,
    problem: {
      ...nums,
      byWeight: raw.byWeight === true,
      gravity: raw.gravity !== false,
      shape: raw.shape as Shape,
      mode: raw.mode as BodyProblem['mode'],
      points,
      constr,
      loads,
    },
  };
}

export class BodyStore {
  private st: BodyState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: BodyPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm3920';
    this.st = {
      extra: structuredClone(BODY_EXTRA_PRESETS.x3701.problem),
      view: 'main',
      problem: copy(BODY_PRESETS[k].problem),
      title: BODY_PRESETS[k].title,
      preset: k,
      canUndo: false,
      canRedo: false,
      notice: null,
      explain: opts.explain ?? true,
    };
  }
  get = (): BodyState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<BodyState>) {
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
  private edit(fn: (p: BodyProblem) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  loadPreset = (k: BodyPresetKey | BodyExtraKey) => {
    this.commit();
    if (k in BODY_EXTRA_PRESETS) {
      const e = BODY_EXTRA_PRESETS[k as BodyExtraKey];
      return this.set({ extra: structuredClone(e.problem), view: 'extra', title: e.title, preset: k });
    }
    this.set({ problem: copy(BODY_PRESETS[k as BodyPresetKey].problem), view: 'main', title: BODY_PRESETS[k as BodyPresetKey].title, preset: k });
  };
  /** Второй экран (пункт 28): кинетический момент, свободное движение, стержень в несколько этапов. */
  xhost = extraHost(BODY_ASKS, this, { commit: () => this.commit(), touch: (k) => this.touch(k), patch: (p) => this.set(p) });
  typeNum = (key: BodyNumKey, v: number) => {
    this.touch(`n:${key}`);
    this.edit((p) => (p[key] = v));
  };
  setFlag = (key: 'byWeight' | 'gravity', on: boolean) => {
    this.commit();
    this.edit((p) => (p[key] = on));
  };
  setShape = (s: Shape) => {
    if (s === this.st.problem.shape) return;
    this.commit();
    this.edit((p) => (p.shape = s));
  };
  setMode = (m: BodyProblem['mode']) => {
    if (m === this.st.problem.mode) return;
    this.commit();
    this.edit((p) => (p.mode = m));
  };
  /* точки */
  addPoint = () => {
    if (this.st.problem.points.length >= MAX) return;
    this.commit();
    this.edit((p) => {
      const used = new Set(['A', 'B', 'C', ...p.points.map((q) => q.name)]);
      const nm = ['D', 'E', 'K', 'O', 'M', 'N', 'Q', 'S', 'D1', 'E1'].find((x) => !used.has(x)) ?? '';
      p.points.push({ name: nm, x: 0, y: 0 });
    });
  };
  removePoint = (i: number) => {
    this.commit();
    this.edit((p) => p.points.splice(i, 1));
  };
  typePointName = (i: number, s: string) => {
    this.touch(`pt:${i}:name`);
    this.edit((p) => (p.points[i].name = s.slice(0, 12)));
  };
  typePoint = (i: number, key: 'x' | 'y', v: number) => {
    this.touch(`pt:${i}:${key}`);
    this.edit((p) => (p.points[i][key] = v));
  };
  /* связи */
  addConstr = () => {
    if (this.st.problem.constr.length >= MAX) return;
    this.commit();
    this.edit((p) => p.constr.push({ kind: 'roller', at: p.shape === 'rod' ? 'A' : 'C', ang: 90, one: true, f: 0, qx: 0, qy: 1 }));
  };
  removeConstr = (i: number) => {
    this.commit();
    this.edit((p) => p.constr.splice(i, 1));
  };
  setConstrKind = (i: number, k: ConstrKind) => {
    this.commit();
    this.edit((p) => (p.constr[i].kind = k));
  };
  setConstrOne = (i: number, on: boolean) => {
    this.commit();
    this.edit((p) => (p.constr[i].one = on));
  };
  typeConstrAt = (i: number, s: string) => {
    this.touch(`c:${i}:at`);
    this.edit((p) => (p.constr[i].at = s.slice(0, 12)));
  };
  typeConstr = (i: number, key: ConstrNumKey, v: number) => {
    this.touch(`c:${i}:${key}`);
    this.edit((p) => (p.constr[i][key] = v));
  };
  /* нагрузки */
  addLoad = (kind: Load['kind']) => {
    if (this.st.problem.loads.length >= MAX) return;
    this.commit();
    this.edit((p) => p.loads.push({ kind, at: 'C', fx: kind === 'force' ? 1 : 0, fy: 0, m: kind === 'moment' ? 1 : 0 }));
  };
  removeLoad = (i: number) => {
    this.commit();
    this.edit((p) => p.loads.splice(i, 1));
  };
  typeLoadAt = (i: number, s: string) => {
    this.touch(`l:${i}:at`);
    this.edit((p) => (p.loads[i].at = s.slice(0, 12)));
  };
  typeLoad = (i: number, key: LoadNumKey, v: number) => {
    this.touch(`l:${i}:${key}`);
    this.edit((p) => (p.loads[i][key] = v));
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
    text: writeEnvelope(BODY_MODULE, this.st.title, { problem: this.st.problem, extra: this.st.extra, view: this.st.view }, now),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== BODY_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseBody(env.raw.problem);
    const x = readExtraView(env.raw, BODY_ASKS, r.ok);
    if (!x.usable) return (this.notify(head + (r.ok ? '' : r.errors.slice(0, 4).join(' ')), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Реакции при плоском движении';
    this.set({ problem: r.ok ? r.problem : this.st.problem, extra: x.extra ?? this.st.extra, view: x.view, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
