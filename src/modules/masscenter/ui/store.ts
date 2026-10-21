/** Состояние вкладки «Центр масс и плоское движение»: шесть режимов, история отмены, файл проекта. */
import type { ExtraProblem } from '../../../shared/extra';
import { extraHost, readExtraView, type XView } from '../../../shared/extraHost';
import { MC_ASKS } from '../model/extra';
import { MC_EXTRA_PRESETS, type McExtraKey } from '../extraPresets';
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { JetProblem, JetStream, LoadSpeed, MomBody, MomentumProblem, PowerProblem, PowerUnit, WorkLoad } from '../model/dynamics';
import type { MPoint, PointsProblem, ShiftPart, ShiftProblem } from '../model/system';
import type { WheelProblem } from '../model/wheel';
import { MC_PRESETS, type McPresetKey } from '../presets';

export const MC_MODULE = 'masscenter';
export type McMode = 'points' | 'shift' | 'wheel' | 'momentum' | 'jet' | 'power';
const MODES: McMode[] = ['points', 'shift', 'wheel', 'momentum', 'jet', 'power'];
export interface McState3 {
  mode: McMode;
  points: PointsProblem;
  shift: ShiftProblem;
  wheel: WheelProblem;
  momentum: MomentumProblem;
  jet: JetProblem;
  power: PowerProblem;
}
export const WHEEL_NUM = ['m', 'g', 'r', 'rho', 'alpha', 'M', 'F', 'T', 'beta', 'e', 'f', 'fk', 't'] as const;
export type WheelNumKey = (typeof WHEEL_NUM)[number];
const MAX = 10;

export interface McState {
  problem: McState3;
  extra: ExtraProblem;
  view: XView;
  title: string;
  preset: McPresetKey | McExtraKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: McState3;
  extra: ExtraProblem;
  view: XView;
  title: string;
  preset: McState['preset'];
}
const copy = <T>(p: T): T => structuredClone(p);
const pick = <K extends McMode>(key: McPresetKey, mode: K) => {
  const t = MC_PRESETS[key].problem;
  return (t.mode === mode ? (t as unknown as Record<K, McState3[K]>)[mode] : null) as McState3[K] | null;
};
const DEF: McState3 = {
  mode: 'wheel',
  points: pick('m357', 'points')!,
  shift: pick('m3519', 'shift')!,
  wheel: pick('m3511', 'wheel')!,
  momentum: pick('m368', 'momentum')!,
  jet: pick('m3614', 'jet')!,
  power: pick('m294', 'power')!,
};

export function presetState(k: McPresetKey, base: McState3 = DEF): McState3 {
  const t = MC_PRESETS[k].problem;
  const s = copy(base);
  s.mode = t.mode;
  if (t.mode === 'points') s.points = copy(t.points);
  if (t.mode === 'shift') s.shift = copy(t.shift);
  if (t.mode === 'wheel') s.wheel = copy(t.wheel);
  if (t.mode === 'momentum') s.momentum = copy(t.momentum);
  if (t.mode === 'jet') s.jet = copy(t.jet);
  if (t.mode === 'power') s.power = copy(t.power);
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

const nm = (x: unknown) => (typeof x === 'string' ? x.slice(0, 30) : '');
function parseMomentumP(raw: unknown): MomentumProblem | null {
  if (!isObj(raw) || !isNum(raw.g) || !isNum(raw.F) || !Array.isArray(raw.bodies) || !isObj(raw.unknown) || !isNum(raw.unknown.i) || ![0, 1].includes(raw.unknown.when as number)) return null;
  const bodies: MomBody[] = [];
  for (const b of raw.bodies) {
    if (!isObj(b) || ![b.m, b.v0, b.ref0, b.v1, b.ref1].every(isNum)) return null;
    bodies.push({ name: nm(b.name), m: b.m as number, v0: b.v0 as number, ref0: b.ref0 as number, v1: b.v1 as number, ref1: b.ref1 as number });
  }
  return { byWeight: raw.byWeight === true, g: raw.g, F: raw.F, bodies, unknown: { i: raw.unknown.i, when: raw.unknown.when as 0 | 1 } };
}
function parseJetP(raw: unknown): JetProblem | null {
  if (!isObj(raw) || ![raw.g, raw.rho, raw.W].every(isNum) || !Array.isArray(raw.streams)) return null;
  const streams: JetStream[] = [];
  for (const x of raw.streams) {
    if (!isObj(x) || ![x.A, x.v, x.ang].every(isNum)) return null;
    streams.push({ name: nm(x.name), out: x.out === true, A: x.A as number, v: x.v as number, ang: x.ang as number });
  }
  return { byWeight: raw.byWeight === true, g: raw.g as number, rho: raw.rho as number, W: raw.W as number, streams };
}
export const LOAD_NUM = ['F', 'alpha', 'f', 'v', 's', 'k', 'd', 'n'] as const;
export type LoadNumKey = (typeof LOAD_NUM)[number];
const SPEEDS: LoadSpeed[] = ['v', 'path', 'rot'];
const PUNITS: PowerUnit[] = ['base', 'kW', 'hp'];
function parsePowerP(raw: unknown): PowerProblem | null {
  if (!isObj(raw) || ![raw.g, raw.eta, raw.t, raw.N].every(isNum) || !Array.isArray(raw.loads) || !['si', 'tech'].includes(raw.units as string) || !PUNITS.includes(raw.Nunit as PowerUnit)) return null;
  if (!(raw.unknown === 'N' || raw.unknown === 't' || isNum(raw.unknown))) return null;
  const loads: WorkLoad[] = [];
  for (const l of raw.loads) {
    if (!isObj(l) || !LOAD_NUM.every((k) => isNum(l[k])) || !['force', 'weight'].includes(l.kind as string) || !SPEEDS.includes(l.speed as LoadSpeed)) return null;
    const nums = Object.fromEntries(LOAD_NUM.map((k) => [k, l[k]])) as Record<LoadNumKey, number>;
    loads.push({ ...nums, name: nm(l.name), kind: l.kind as WorkLoad['kind'], speed: l.speed as LoadSpeed });
  }
  return { units: raw.units as PowerProblem['units'], g: raw.g as number, eta: raw.eta as number, driving: raw.driving === true, t: raw.t as number, N: raw.N as number, Nunit: raw.Nunit as PowerUnit, unknown: raw.unknown as PowerProblem['unknown'], loads };
}

export function parseMc(raw: unknown): { ok: true; problem: McState3 } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !MODES.includes(raw.mode as McMode)) return { ok: false, errors: ['В файле нет задачи (problem с полем mode).'] };
  const points = parsePointsP(raw.points),
    shift = parseShiftP(raw.shift),
    wheel = parseWheelP(raw.wheel),
    momentum = parseMomentumP(raw.momentum),
    jet = parseJetP(raw.jet),
    power = parsePowerP(raw.power);
  if (!{ points, shift, wheel, momentum, jet, power }[raw.mode as McMode]) return { ok: false, errors: ['Данные задачи неполные.'] };
  return {
    ok: true,
    problem: {
      mode: raw.mode as McMode,
      points: points ?? copy(DEF.points),
      shift: shift ?? copy(DEF.shift),
      wheel: wheel ?? copy(DEF.wheel),
      momentum: momentum ?? copy(DEF.momentum),
      jet: jet ?? copy(DEF.jet),
      power: power ?? copy(DEF.power),
    },
  };
}

export class McStore {
  private st: McState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: McPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm3511';
    this.st = { extra: structuredClone(MC_EXTRA_PRESETS.x2901.problem), view: 'main', problem: presetState(k), title: MC_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
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
  private snap = (): Snap => ({ problem: this.st.problem, extra: this.st.extra, view: this.st.view, title: this.st.title, preset: this.st.preset });
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
  loadPreset = (k: McPresetKey | McExtraKey) => {
    this.commit();
    if (k in MC_EXTRA_PRESETS) {
      const e = MC_EXTRA_PRESETS[k as McExtraKey];
      return this.set({ extra: structuredClone(e.problem), view: 'extra', title: e.title, preset: k });
    }
    this.set({ problem: presetState(k as McPresetKey, this.st.problem), view: 'main', title: MC_PRESETS[k as McPresetKey].title, preset: k });
  };
  /** Второй экран (пункт 28): опрокидывание массива, маятник, крановая тележка, Яблонский Д.7, Д.8, Д.12. */
  xhost = extraHost(MC_ASKS, this, { commit: () => this.commit(), touch: (k) => this.touch(k), patch: (p) => this.set(p) });
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
  /* количество движения */
  setMomFlag = (on: boolean) => {
    this.commit();
    this.edit((p) => (p.momentum.byWeight = on));
  };
  typeMomNum = (key: 'g' | 'F', v: number) => {
    this.touch(`mo:${key}`);
    this.edit((p) => (p.momentum[key] = v));
  };
  typeBody = (i: number, key: 'm' | 'v0' | 'v1', v: number) => {
    this.touch(`mb:${i}:${key}`);
    this.edit((p) => (p.momentum.bodies[i][key] = v));
  };
  typeBodyName = (i: number, s: string) => {
    this.touch(`mb:${i}:name`);
    this.edit((p) => (p.momentum.bodies[i].name = s.slice(0, 30)));
  };
  setBodyRef = (i: number, key: 'ref0' | 'ref1', ref: number) => {
    this.commit();
    this.edit((p) => (p.momentum.bodies[i][key] = ref));
  };
  setMomUnknown = (i: number, when: 0 | 1) => {
    this.commit();
    this.edit((p) => (p.momentum.unknown = { i, when }));
  };
  addBody = () => {
    if (this.st.problem.momentum.bodies.length >= MAX) return;
    this.commit();
    this.edit((p) => p.momentum.bodies.push({ name: '', m: 1, v0: 0, ref0: -1, v1: 0, ref1: -1 }));
  };
  removeBody = (i: number) => {
    if (this.st.problem.momentum.bodies.length <= 1) return;
    this.commit();
    this.edit((p) => {
      const m = p.momentum;
      m.bodies.splice(i, 1);
      const fix = (r: number) => (r === i ? -1 : r > i ? r - 1 : r);
      m.bodies.forEach((b) => ((b.ref0 = fix(b.ref0)), (b.ref1 = fix(b.ref1))));
      if (m.unknown.i === i) m.unknown = { i: 0, when: 1 };
      else if (m.unknown.i > i) m.unknown.i--;
    });
  };
  /* струя */
  setJetFlag = (on: boolean) => {
    this.commit();
    this.edit((p) => (p.jet.byWeight = on));
  };
  typeJetNum = (key: 'g' | 'rho' | 'W', v: number) => {
    this.touch(`j:${key}`);
    this.edit((p) => (p.jet[key] = v));
  };
  typeStream = (i: number, key: 'A' | 'v' | 'ang', v: number) => {
    this.touch(`js:${i}:${key}`);
    this.edit((p) => (p.jet.streams[i][key] = v));
  };
  typeStreamName = (i: number, s: string) => {
    this.touch(`js:${i}:name`);
    this.edit((p) => (p.jet.streams[i].name = s.slice(0, 30)));
  };
  setStreamOut = (i: number, out: boolean) => {
    this.commit();
    this.edit((p) => (p.jet.streams[i].out = out));
  };
  addStream = () => {
    if (this.st.problem.jet.streams.length >= MAX) return;
    this.commit();
    this.edit((p) => p.jet.streams.push({ name: '', out: true, A: 0, v: 1, ang: 0 }));
  };
  removeStream = (i: number) => {
    if (this.st.problem.jet.streams.length <= 1) return;
    this.commit();
    this.edit((p) => p.jet.streams.splice(i, 1));
  };
  /* работа и мощность */
  typePowerNum = (key: 'g' | 'eta' | 't' | 'N', v: number) => {
    this.touch(`w:${key}`);
    this.edit((p) => (p.power[key] = v));
  };
  setPower = <K extends 'units' | 'driving' | 'Nunit' | 'unknown'>(key: K, v: PowerProblem[K]) => {
    this.commit();
    this.edit((p) => (p.power[key] = v));
  };
  typeLoad = (i: number, key: LoadNumKey, v: number) => {
    this.touch(`wl:${i}:${key}`);
    this.edit((p) => (p.power.loads[i][key] = v));
  };
  typeLoadName = (i: number, s: string) => {
    this.touch(`wl:${i}:name`);
    this.edit((p) => (p.power.loads[i].name = s.slice(0, 30)));
  };
  setLoad = <K extends 'kind' | 'speed'>(i: number, key: K, v: WorkLoad[K]) => {
    this.commit();
    this.edit((p) => (p.power.loads[i][key] = v));
  };
  addLoad = () => {
    if (this.st.problem.power.loads.length >= MAX) return;
    this.commit();
    this.edit((p) => p.power.loads.push({ name: '', kind: 'force', F: 1, alpha: 0, f: 0, speed: 'v', v: 1, s: 1, k: 1, d: 1, n: 60 }));
  };
  removeLoad = (i: number) => {
    if (this.st.problem.power.loads.length <= 1) return;
    this.commit();
    this.edit((p) => {
      const w = p.power;
      w.loads.splice(i, 1);
      if (typeof w.unknown === 'number') w.unknown = w.unknown === i ? 'N' : w.unknown > i ? w.unknown - 1 : w.unknown;
    });
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
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(MC_MODULE, this.st.title, { problem: this.st.problem, extra: this.st.extra, view: this.st.view }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== MC_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseMc(env.raw.problem);
    const x = readExtraView(env.raw, MC_ASKS, r.ok);
    if (!x.usable) return (this.notify(head + (r.ok ? '' : r.errors.slice(0, 4).join(' ')), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Центр масс';
    this.set({ problem: r.ok ? r.problem : this.st.problem, extra: x.extra ?? this.st.extra, view: x.view, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
