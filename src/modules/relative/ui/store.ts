/**
 * Состояние вкладки «Сложное движение точки»: три режима — точка на движущемся теле, движение относительно
 * вращающейся Земли, треугольник скоростей (обратные задачи); история отмены, файл проекта.
 */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { EarthKin } from '../model/earth';
import type { Plane, RelProblem } from '../model/rel';
import { TRI_VECS, type TriItem, type TriProblem, type TriVec } from '../model/tri';
import { EARTH0, EARTH_PRESETS, REL0, REL_PRESETS, TRI0, TRI_PRESETS, type EarthPresetKey, type RelPresetKey, type TriPresetKey } from '../presets';

export const REL_MODULE = 'relative';
export const REL_STR = ['phi', 'xe', 'ye', 'ze', 'x', 'y', 'z', 'ang', 'R', 's'] as const;
export type RelStrKey = (typeof REL_STR)[number];
export const EARTH_NUM = ['lat', 'h', 'R', 'omega', 'vE', 'vN', 'vh', 'v', 'k', 'dE', 'dN', 'dh'] as const;
export type EarthNumKey = (typeof EARTH_NUM)[number];
export type RelMode = 'body' | 'earth' | 'tri';
export type AnyRelKey = RelPresetKey | EarthPresetKey | TriPresetKey;
export type TriKey = TriVec | 'v2' | 'e2' | 'r2';

export interface RelState {
  mode: RelMode;
  problem: RelProblem;
  earth: EarthKin;
  tri: TriProblem;
  title: string;
  preset: AnyRelKey | 'custom';
  show: 'v' | 'a';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  mode: RelMode;
  problem: RelProblem;
  earth: EarthKin;
  tri: TriProblem;
  title: string;
  preset: RelState['preset'];
}
const copy = <T>(p: T): T => structuredClone(p);

export function parseEarth(raw: unknown): EarthKin | null {
  if (!isObj(raw) || !EARTH_NUM.every((k) => isNum(raw[k])) || !['enu', 'course'].includes(raw.vin as string)) return null;
  const nums = Object.fromEntries(EARTH_NUM.map((k) => [k, raw[k]])) as Record<EarthNumKey, number>;
  return { ...nums, vin: raw.vin as EarthKin['vin'] };
}
function parseItem(raw: unknown): TriItem | null {
  if (!isObj(raw) || !isNum(raw.mod) || !isNum(raw.dir)) return null;
  return { mod: raw.mod, dir: raw.dir, qm: raw.qm === true, qd: raw.qd === true };
}
export function parseTri(raw: unknown): TriProblem | null {
  if (!isObj(raw) || !['v', 'a'].includes(raw.what as string)) return null;
  const its = (['v', 'e', 'r', 'v2', 'e2', 'r2'] as const).map((k) => parseItem(raw[k]));
  if (its.some((x) => !x) || !isObj(raw.c) || !isNum(raw.c.mod) || !isNum(raw.c.dir)) return null;
  const [v, e, r, v2, e2, r2] = its as TriItem[];
  const shared = TRI_VECS.includes(raw.shared as TriVec) ? (raw.shared as TriVec) : 'v';
  return { what: raw.what as TriProblem['what'], compass: raw.compass === true, v, e, r, c: { mod: raw.c.mod, dir: raw.c.dir }, two: raw.two === true, shared, v2, e2, r2 };
}

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
  constructor(opts: { preset?: AnyRelKey; explain?: boolean } = {}) {
    this.st = { mode: 'body', problem: copy(REL_PRESETS.r2327.problem as RelProblem), earth: copy(EARTH0), tri: copy(TRI0), title: '', preset: 'r2327', show: 'a', canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
    this.st = { ...this.st, ...this.presetPatch(opts.preset ?? 'r2327') };
  }
  /** Данные готовой задачи: режим и задача этого режима (остальные режимы не меняются). */
  private presetPatch(k: AnyRelKey): Partial<RelState> {
    if (k in EARTH_PRESETS) {
      const p = EARTH_PRESETS[k as EarthPresetKey];
      return { mode: 'earth', earth: copy(p.problem), title: p.title, preset: k };
    }
    if (k in TRI_PRESETS) {
      const p = TRI_PRESETS[k as TriPresetKey];
      return { mode: 'tri', tri: copy(p.problem), title: p.title, preset: k };
    }
    const p = REL_PRESETS[k as RelPresetKey];
    return { mode: 'body', problem: copy(p.problem as RelProblem), title: p.title, preset: k };
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
  private snap = (): Snap => ({ mode: this.st.mode, problem: this.st.problem, earth: this.st.earth, tri: this.st.tri, title: this.st.title, preset: this.st.preset });
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
  loadPreset = (k: AnyRelKey) => {
    this.commit();
    this.set(this.presetPatch(k));
  };
  setMode = (mode: RelMode) => {
    if (mode === this.st.mode) return;
    this.commit();
    this.set({ mode });
  };
  /* движение относительно Земли */
  typeEarth = (k: EarthNumKey, v: number) => {
    this.touch(`e:${k}`);
    this.set({ earth: { ...this.st.earth, [k]: v } });
  };
  setEarthVin = (vin: EarthKin['vin']) => {
    if (vin === this.st.earth.vin) return;
    this.commit();
    this.set({ earth: { ...this.st.earth, vin } });
  };
  /* треугольник скоростей */
  private editTri(fn: (t: TriProblem) => void) {
    const t = copy(this.st.tri);
    fn(t);
    this.set({ tri: t });
  }
  typeTri = (k: TriKey, part: 'mod' | 'dir', v: number) => {
    this.touch(`t:${k}:${part}`);
    this.editTri((t) => (t[k][part] = v));
  };
  typeTriC = (part: 'mod' | 'dir', v: number) => {
    this.touch(`t:c:${part}`);
    this.editTri((t) => (t.c[part] = v));
  };
  setTriUnknown = (k: TriKey, part: 'qm' | 'qd', on: boolean) => {
    this.commit();
    this.editTri((t) => (t[k][part] = on));
  };
  setTriOpt = (patch: Partial<Pick<TriProblem, 'what' | 'compass' | 'two' | 'shared'>>) => {
    this.commit();
    this.editTri((t) => Object.assign(t, patch));
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
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(REL_MODULE, this.st.title, { mode: this.st.mode, problem: this.st.problem, earth: this.st.earth, tri: this.st.tri }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== REL_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    // Файлы до режимов «Земля» и «треугольник» — только problem.
    const mode: RelMode = env.raw.mode === 'earth' || env.raw.mode === 'tri' ? env.raw.mode : 'body';
    const r = parseRel(env.raw.problem);
    const earth = env.raw.earth == null ? copy(EARTH0) : parseEarth(env.raw.earth);
    const tri = env.raw.tri == null ? copy(TRI0) : parseTri(env.raw.tri);
    if (!r.ok && mode === 'body') return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    if (!earth || !tri || (mode !== 'body' && env.raw.problem != null && !r.ok)) return (this.notify(head + 'данные задачи неполные.', 'bad'), false);
    this.commit();
    const title = env.title ?? 'Сложное движение точки';
    this.set({ mode, problem: r.ok ? r.problem : copy(REL0), earth, tri, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
