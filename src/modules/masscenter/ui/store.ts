/** Состояние вкладки «Центр масс и плоское движение»: три режима, история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { MPoint, PointsProblem, ShiftPart, ShiftProblem } from '../model/system';
import type { WheelProblem } from '../model/wheel';
import { MC_PRESETS, type McPresetKey } from '../presets';

export const MC_MODULE = 'masscenter';
export type McMode = 'points' | 'shift' | 'wheel';
export interface McState3 {
  mode: McMode;
  points: PointsProblem;
  shift: ShiftProblem;
  wheel: WheelProblem;
}
export const WHEEL_NUM = ['m', 'g', 'r', 'rho', 'alpha', 'M', 'F', 'T', 'beta', 'e', 'f', 'fk', 't'] as const;
export type WheelNumKey = (typeof WHEEL_NUM)[number];
const MAX = 10;

export interface McState {
  problem: McState3;
  title: string;
  preset: McPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: McState3;
  title: string;
  preset: McState['preset'];
}
const copy = <T>(p: T): T => structuredClone(p);
const pick = <K extends 'points' | 'shift' | 'wheel'>(key: McPresetKey, mode: K) => {
  const t = MC_PRESETS[key].problem;
  return (t.mode === mode ? (t as unknown as Record<K, McState3[K]>)[mode] : null) as McState3[K] | null;
};
const DEF: McState3 = { mode: 'wheel', points: pick('m357', 'points')!, shift: pick('m3519', 'shift')!, wheel: pick('m3511', 'wheel')! };

export function presetState(k: McPresetKey, base: McState3 = DEF): McState3 {
  const t = MC_PRESETS[k].problem;
  const s = copy(base);
  s.mode = t.mode;
  if (t.mode === 'points') s.points = copy(t.points);
  if (t.mode === 'shift') s.shift = copy(t.shift);
  if (t.mode === 'wheel') s.wheel = copy(t.wheel);
  return s;
}

function parsePointsP(raw: unknown): PointsProblem | null {
  if (!isObj(raw) || !Array.isArray(raw.pts) || ![raw.g, raw.t, raw.t1, raw.t2].every(isNum)) return null;
  const pts: MPoint[] = [];
  for (const p of raw.pts) {
    if (!isObj(p) || !isNum(p.m) || typeof p.x !== 'string' || typeof p.y !== 'string') return null;
    pts.push({ name: typeof p.name === 'string' ? p.name.slice(0, 30) : '', m: p.m, x: p.x.slice(0, 200), y: p.y.slice(0, 200) });
  }
  return { byWeight: raw.byWeight === true, gravity: raw.gravity !== false, g: raw.g as number, t: raw.t as number, t1: raw.t1 as number, t2: raw.t2 as number, pts };
}
function parseShiftP(raw: unknown): ShiftProblem | null {
  if (!isObj(raw) || !isNum(raw.M0) || !isNum(raw.unknown) || !Array.isArray(raw.parts)) return null;
  const parts: ShiftPart[] = [];
  for (const p of raw.parts) {
    if (!isObj(p) || !isNum(p.m) || !isNum(p.s) || !isNum(p.theta)) return null;
    parts.push({ name: typeof p.name === 'string' ? p.name.slice(0, 30) : '', m: p.m, s: p.s, theta: p.theta });
  }
  return { M0: raw.M0, unknown: raw.unknown, parts };
}
function parseWheelP(raw: unknown): WheelProblem | null {
  if (!isObj(raw) || !WHEEL_NUM.every((k) => isNum(raw[k])) || !['disk', 'ring', 'rho'].includes(raw.inertia as string)) return null;
  const nums = Object.fromEntries(WHEEL_NUM.map((k) => [k, raw[k]])) as Record<WheelNumKey, number>;
  return { ...nums, byWeight: raw.byWeight === true, inertia: raw.inertia as WheelProblem['inertia'] };
}

export function parseMc(raw: unknown): { ok: true; problem: McState3 } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !['points', 'shift', 'wheel'].includes(raw.mode as string)) return { ok: false, errors: ['В файле нет задачи (problem с полем mode).'] };
  const points = parsePointsP(raw.points),
    shift = parseShiftP(raw.shift),
    wheel = parseWheelP(raw.wheel);
  if (!{ points, shift, wheel }[raw.mode as McMode]) return { ok: false, errors: ['Данные задачи неполные.'] };
  return { ok: true, problem: { mode: raw.mode as McMode, points: points ?? copy(DEF.points), shift: shift ?? copy(DEF.shift), wheel: wheel ?? copy(DEF.wheel) } };
}

export class McStore {
  private st: McState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: McPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm3511';
    this.st = { problem: presetState(k), title: MC_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): McState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<McState>) {
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
  private edit(fn: (p: McState3) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  loadPreset = (k: McPresetKey) => {
    this.commit();
    this.set({ problem: presetState(k, this.st.problem), title: MC_PRESETS[k].title, preset: k });
  };
  setMode = (m: McMode) => {
    if (m === this.st.problem.mode) return;
    this.commit();
    this.edit((p) => (p.mode = m));
  };
  /* точки */
  setPointsFlag = (key: 'byWeight' | 'gravity', on: boolean) => {
    this.commit();
    this.edit((p) => (p.points[key] = on));
  };
  typePointsNum = (key: 'g' | 't' | 't1' | 't2', v: number) => {
    this.touch(`p:${key}`);
    this.edit((p) => (p.points[key] = v));
  };
  typePt = (i: number, key: 'name' | 'x' | 'y', s: string) => {
    this.touch(`pt:${i}:${key}`);
    this.edit((p) => (p.points.pts[i][key] = s.slice(0, key === 'name' ? 30 : 200)));
  };
  typePtMass = (i: number, v: number) => {
    this.touch(`pt:${i}:m`);
    this.edit((p) => (p.points.pts[i].m = v));
  };
  addPt = () => {
    if (this.st.problem.points.pts.length >= MAX) return;
    this.commit();
    this.edit((p) => p.points.pts.push({ name: '', m: 1, x: '', y: '' }));
  };
  removePt = (i: number) => {
    if (this.st.problem.points.pts.length <= 1) return;
    this.commit();
    this.edit((p) => p.points.pts.splice(i, 1));
  };
  /* смещение */
  typeShiftM0 = (v: number) => {
    this.touch('s:M0');
    this.edit((p) => (p.shift.M0 = v));
  };
  typePart = (i: number, key: 'm' | 's' | 'theta', v: number) => {
    this.touch(`sp:${i}:${key}`);
    this.edit((p) => (p.shift.parts[i][key] = v));
  };
  typePartName = (i: number, s: string) => {
    this.touch(`sp:${i}:name`);
    this.edit((p) => (p.shift.parts[i].name = s.slice(0, 30)));
  };
  setUnknown = (i: number) => {
    this.commit();
    this.edit((p) => (p.shift.unknown = i));
  };
  addPart = () => {
    if (this.st.problem.shift.parts.length >= MAX) return;
    this.commit();
    this.edit((p) => p.shift.parts.push({ name: '', m: 1, s: 1, theta: 0 }));
  };
  removePart = (i: number) => {
    if (this.st.problem.shift.parts.length <= 1) return;
    this.commit();
    this.edit((p) => {
      p.shift.parts.splice(i, 1);
      if (p.shift.unknown >= p.shift.parts.length || p.shift.unknown === i) p.shift.unknown = -1;
      else if (p.shift.unknown > i) p.shift.unknown--;
    });
  };
  /* колесо */
  typeWheel = (key: WheelNumKey, v: number) => {
    this.touch(`w:${key}`);
    this.edit((p) => (p.wheel[key] = v));
  };
  setWheelInertia = (k: WheelProblem['inertia']) => {
    this.commit();
    this.edit((p) => (p.wheel.inertia = k));
  };
  setWheelByWeight = (on: boolean) => {
    this.commit();
    this.edit((p) => (p.wheel.byWeight = on));
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
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(MC_MODULE, this.st.title, { problem: this.st.problem }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== MC_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseMc(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Центр масс';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
