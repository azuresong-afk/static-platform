/** Состояние вкладки «Тяготение и орбиты»: небесное тело, орбита, движение по прямой; история отмены, файл проекта. */
import type { ExtraProblem } from '../../../shared/extra';
import { extraHost, readExtraView, type XView } from '../../../shared/extraHost';
import { ORBIT_ASKS } from '../model/extra';
import { ORB_EXTRA_PRESETS, type OrbExtraKey } from '../extraPresets';
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import { BODIES, type OrbitProblem, type PlanetProblem, type RadialProblem, type Unit } from '../model/orbit';
import type { TrajProblem } from '../model/traj';
import { ORB_PRESETS, orbit, planet, radial, traj, type OrbMode, type OrbPresetKey, type OrbState } from '../presets';

export const ORBIT_MODULE = 'orbit';
export const PLANET_NUM = ['g', 'R', 'mRatio', 'rRatio', 'H', 'Trot', 'G'] as const;
export type PlanetNumKey = (typeof PLANET_NUM)[number];
export const ORBIT_NUM = ['mu', 'g', 'R', 'm', 'r0', 'v0', 'th0', 'ph0', 'e1', 'e2', 'T', 'vp', 'dvt', 'dvr', 'tgtVal', 'r1', 't1'] as const;
export type OrbitNumKey = (typeof ORBIT_NUM)[number];
export const RADIAL_NUM = ['mu1', 'g', 'R', 'k2', 'd', 'acc', 'vinf', 'x0', 'v0', 'x1'] as const;
export type RadialNumKey = (typeof RADIAL_NUM)[number];
export const TRAJ_NUM = [
  'mu',
  'g',
  'R',
  'a',
  'e',
  'x1',
  'x2',
  'r0',
  'th0',
  'v0',
  'p',
  'c',
  'T',
  'Hd',
  'gam',
  'a1',
  'T1',
  'a2',
  'T2',
  'cb',
  'phi1',
  'H',
  'alpha',
  'Trot',
  'turns',
  'm1',
  'm2',
  'fG',
  'Jf',
  'J0',
  'Om0',
  'M0',
  'kap',
  'Tc',
  'u0',
  'psi',
] as const;
export type TrajNumKey = (typeof TRAJ_NUM)[number];
export type TrajSel = 'kind' | 'unit' | 'muMode' | 'anom' | 'inv' | 'fw';
export type OrbitSel = 'unit' | 'force' | 'muMode' | 'def' | 'shape' | 'scale' | 'man' | 'tgtKind' | 'tgt';
export type RadialSel = 'unit' | 'muMode' | 'ask' | 'repel' | 'two' | 'fromInf';
const UNITS: Unit[] = ['km', 'm', 'cm'];
const ORBIT_SEL: Record<OrbitSel, readonly string[]> = {
  unit: UNITS,
  force: ['newton', 'formula'],
  muMode: ['mu', 'planet'],
  def: ['state', 'elements'],
  shape: ['apsides', 'ae', 'ab', 'pe'],
  scale: ['mu', 'T', 'vp'],
  man: ['none', 'impulse', 'target'],
  tgtKind: ['tang', 'rad'],
  tgt: ['apo', 'peri', 'vinf'],
};
const TRAJ_SEL: Record<TrajSel, readonly string[]> = {
  kind: ['point', 'time', 'mean', 'fall', 'inverse', 'binet', 'track', 'two', 'flywheel'],
  unit: UNITS,
  muMode: ['mu', 'planet'],
  anom: ['nu', 'E', 'M', 't'],
  inv: ['axes', 'ecc', 'sma', 'mass'],
  fw: ['stop', 'motor', 'turn'],
};
const BODY_KEYS = [...Object.keys(BODIES), 'ratio', 'custom'];

export interface OrbStoreState {
  problem: OrbState;
  extra: ExtraProblem;
  view: XView;
  title: string;
  preset: OrbPresetKey | OrbExtraKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: OrbState;
  extra: ExtraProblem;
  view: XView;
  title: string;
  preset: OrbStoreState['preset'];
}
const copy = <T>(p: T): T => structuredClone(p);
const DEF: OrbState = { mode: 'orbit', planet: planet({ H: 300 }), orbit: orbit({}), radial: radial({}), traj: traj({}) };

export function presetState(k: OrbPresetKey, base: OrbState = DEF): OrbState {
  const t = ORB_PRESETS[k].problem;
  const s = copy(base);
  s.mode = t.mode;
  if (t.mode === 'planet') s.planet = copy(t.planet);
  else if (t.mode === 'orbit') s.orbit = copy(t.orbit);
  else if (t.mode === 'radial') s.radial = copy(t.radial);
  else s.traj = copy(t.traj);
  return s;
}

const nums = <K extends string>(raw: Record<string, unknown>, keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, raw[k]])) as Record<K, number>;

function parsePlanet(raw: unknown): PlanetProblem | null {
  if (!isObj(raw) || !PLANET_NUM.every((k) => isNum(raw[k])) || !BODY_KEYS.includes(raw.body as string)) return null;
  return { ...nums(raw, PLANET_NUM), body: raw.body as PlanetProblem['body'] };
}
function parseOrbit(raw: unknown): OrbitProblem | null {
  if (!isObj(raw) || !ORBIT_NUM.every((k) => isNum(raw[k])) || typeof raw.ar !== 'string') return null;
  for (const [k, vals] of Object.entries(ORBIT_SEL)) if (!vals.includes(raw[k] as string)) return null;
  const sel = Object.fromEntries(Object.keys(ORBIT_SEL).map((k) => [k, raw[k]])) as Pick<OrbitProblem, OrbitSel>;
  return { ...nums(raw, ORBIT_NUM), ...sel, ar: raw.ar.slice(0, 200) };
}
function parseRadial(raw: unknown): RadialProblem | null {
  if (!isObj(raw) || !RADIAL_NUM.every((k) => isNum(raw[k]))) return null;
  if (!UNITS.includes(raw.unit as Unit) || !['mu', 'planet'].includes(raw.muMode as string) || !['top', 'at', 'v0', 'x0'].includes(raw.ask as string))
    return null;
  return {
    ...nums(raw, RADIAL_NUM),
    unit: raw.unit as Unit,
    muMode: raw.muMode as RadialProblem['muMode'],
    ask: raw.ask as RadialProblem['ask'],
    repel: raw.repel === true,
    two: raw.two === true,
    fromInf: raw.fromInf === true,
  };
}

function parseTraj(raw: unknown): TrajProblem | null {
  if (!isObj(raw) || !TRAJ_NUM.every((k) => isNum(raw[k])) || typeof raw.rphi !== 'string') return null;
  for (const [k, vals] of Object.entries(TRAJ_SEL)) if (!vals.includes(raw[k] as string)) return null;
  const sel = Object.fromEntries(Object.keys(TRAJ_SEL).map((k) => [k, raw[k]])) as Pick<TrajProblem, TrajSel>;
  return { ...nums(raw, TRAJ_NUM), ...sel, rphi: raw.rphi.slice(0, 200) };
}

export function parseOrb(raw: unknown): { ok: true; problem: OrbState } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !['planet', 'orbit', 'radial', 'traj'].includes(raw.mode as string))
    return { ok: false, errors: ['В файле нет задачи (problem с полем mode).'] };
  const p = parsePlanet(raw.planet),
    o = parseOrbit(raw.orbit),
    x = parseRadial(raw.radial),
    k = parseTraj(raw.traj);
  const cur = raw.mode === 'planet' ? p : raw.mode === 'orbit' ? o : raw.mode === 'radial' ? x : k;
  if (!cur) return { ok: false, errors: ['Данные задачи неполные.'] };
  return {
    ok: true,
    problem: {
      mode: raw.mode as OrbMode,
      planet: p ?? copy(DEF.planet),
      orbit: o ?? copy(DEF.orbit),
      radial: x ?? copy(DEF.radial),
      traj: k ?? copy(DEF.traj),
    },
  };
}

export class OrbStore {
  private st: OrbStoreState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: OrbPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm5022';
    this.st = { extra: structuredClone(ORB_EXTRA_PRESETS.x5007.problem), view: 'main', problem: presetState(k), title: ORB_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): OrbStoreState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<OrbStoreState>) {
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
  private edit(fn: (p: OrbState) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  loadPreset = (k: OrbPresetKey | OrbExtraKey) => {
    this.commit();
    if (k in ORB_EXTRA_PRESETS) {
      const e = ORB_EXTRA_PRESETS[k as OrbExtraKey];
      return this.set({ extra: structuredClone(e.problem), view: 'extra', title: e.title, preset: k });
    }
    this.set({ problem: presetState(k as OrbPresetKey, this.st.problem), view: 'main', title: ORB_PRESETS[k as OrbPresetKey].title, preset: k });
  };
  /** Второй экран (пункт 28): выводы формул §50, стыковка, оптимальная орбита, метеориты. */
  xhost = extraHost(ORBIT_ASKS, this, { commit: () => this.commit(), touch: (k) => this.touch(k), patch: (p) => this.set(p) });
  setMode = (m: OrbMode) => {
    if (m === this.st.problem.mode) return;
    this.commit();
    this.edit((p) => (p.mode = m));
  };
  /* небесное тело */
  typePlanet = (key: PlanetNumKey, v: number) => {
    this.touch(`p:${key}`);
    this.edit((p) => (p.planet[key] = v));
  };
  setBody = (b: PlanetProblem['body']) => {
    this.commit();
    this.edit((p) => (p.planet.body = b));
  };
  /* орбита */
  typeOrbit = (key: OrbitNumKey, v: number) => {
    this.touch(`o:${key}`);
    this.edit((p) => (p.orbit[key] = v));
  };
  setOrbit = <K extends OrbitSel>(key: K, v: OrbitProblem[K]) => {
    this.commit();
    this.edit((p) => (p.orbit[key] = v));
  };
  typeAr = (s: string) => {
    this.touch('o:ar');
    this.edit((p) => (p.orbit.ar = s.slice(0, 200)));
  };
  /* прямолинейное движение */
  typeRadial = (key: RadialNumKey, v: number) => {
    this.touch(`x:${key}`);
    this.edit((p) => (p.radial[key] = v));
  };
  setRadial = <K extends RadialSel>(key: K, v: RadialProblem[K]) => {
    this.commit();
    this.edit((p) => {
      p.radial[key] = v;
      // Из бесконечности ищется только скорость в точке x₁.
      if (key === 'fromInf' && v === true) p.radial.ask = 'at';
    });
  };
  /* формулы Кеплера, Бине, трасса */
  typeTraj = (key: TrajNumKey, v: number) => {
    this.touch(`k:${key}`);
    this.edit((p) => (p.traj[key] = v));
  };
  setTraj = <K extends TrajSel>(key: K, v: TrajProblem[K]) => {
    this.commit();
    this.edit((p) => {
      p.traj[key] = v;
      // «Время полёта» задаёт точки аномалиями, а не временем от перицентра.
      if (key === 'kind' && v === 'time' && p.traj.anom === 't') p.traj.anom = 'nu';
    });
  };
  typeRphi = (s: string) => {
    this.touch('k:rphi');
    this.edit((p) => (p.traj.rphi = s.slice(0, 200)));
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
    text: writeEnvelope(ORBIT_MODULE, this.st.title, { problem: this.st.problem, extra: this.st.extra, view: this.st.view }, now),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== ORBIT_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseOrb(env.raw.problem);
    const x = readExtraView(env.raw, ORBIT_ASKS, r.ok);
    if (!x.usable) return (this.notify(head + (r.ok ? '' : r.errors.slice(0, 4).join(' ')), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Тяготение и орбиты';
    this.set({ problem: r.ok ? r.problem : this.st.problem, extra: x.extra ?? this.st.extra, view: x.view, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
