/**
 * Состояние вкладки «Динамика точки»: десять режимов — прямолинейное движение (вторая задача),
 * силы по заданному движению (первая задача), криволинейное движение в плоскости, движение по окружности
 * (реакция связи, отрыв), относительное движение в трубке подвижного тела, движение вблизи вращающейся Земли,
 * равновесие при вращении, движение по поверхности и кривой, составные задачи, теорема об импульсе;
 * история отмены, файл проекта.
 */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { CircleProblem } from '../model/circle';
import type { EarthDyn } from '../model/earth';
import type { FirstProblem } from '../model/first';
import type { PlaneProblem } from '../model/plane';
import type { PointProblem } from '../model/point';
import type { RelProblem } from '../model/rel';
import { FINDS, type SpinProblem } from '../model/spin';
import type { SurfProblem } from '../model/surf';
import type { StageProblem } from '../model/stages';
import type { ImpulseProblem } from '../model/impulse';
import {
  CIRCLE_PRESETS,
  EARTH_PRESETS,
  FIRST_PRESETS,
  PLANE_PRESETS,
  POINT_PRESETS,
  REL_PRESETS,
  SPIN_PRESETS,
  SURF_PRESETS,
  STAGE_PRESETS,
  IMPULSE_PRESETS,
  type CirclePresetKey,
  type EarthPresetKey,
  type FirstPresetKey,
  type PlanePresetKey,
  type PointPresetKey,
  type RelPresetKey,
  type SpinPresetKey,
  type SurfPresetKey,
  type StagePresetKey,
  type ImpulsePresetKey,
} from '../presets';

export const POINT_MODULE = 'pointdyn';
export const NUM_KEYS = ['m', 'alpha', 'f', 'F0', 'at', 'F1', 'p', 'c', 'kv', 'kq', 'x0', 'v0', 't', 'v1', 'x1'] as const;
export type PointNumKey = (typeof NUM_KEYS)[number];
export const FIRST_NUM = ['m', 'g', 't', 't1', 't2'] as const;
export type FirstNumKey = (typeof FIRST_NUM)[number];
export const PLANE_NUM = ['m', 'g', 'Fx', 'Fy', 'kv', 'kq', 'c', 'cx', 'cy', 'q', 'x0', 'y0', 'v0', 'ang', 't', 'y1', 'x1'] as const;
export type PlaneNumKey = (typeof PLANE_NUM)[number];
export const CIRCLE_NUM = ['m', 'g', 'R', 'phi0', 'v0', 'ax', 'ay', 'c', 'L0', 'phi1'] as const;
export type CircleNumKey = (typeof CIRCLE_NUM)[number];
const LINKS: CircleProblem['link'][] = ['thread', 'inner', 'outer', 'rod'];
export const REL_NUM = ['m', 'g', 'omega', 'r', 'd', 'h', 'theta', 'c', 'l0', 'f', 'x0', 'v0', 't1', 'x1'] as const;
export type RelNumKey = (typeof REL_NUM)[number];
const FRAMES: RelProblem['frame'][] = ['vert', 'horz', 'trans'];
export const EARTH_NUM = ['m', 'g', 'lat', 'omega', 'R', 'h', 'vE', 'vN', 'vh', 'v', 'k', 'L', 'b', 'psi'] as const;
export type EarthNumKey = (typeof EARTH_NUM)[number];
const ASKS: EarthDyn['ask'][] = ['fall', 'line', 'pend', 'g'];
export const SPIN_NUM = ['m', 'g', 'R', 'v', 'alpha', 'f', 'd', 'k', 'l', 'theta', 'omega', 'r', 'T', 'D', 'c', 'rs', 'r2', 'w2', 'a', 'b', 'gamma', 'phi', 'x1'] as const;
export type SpinNumKey = (typeof SPIN_NUM)[number];
export const SURF_NUM = ['m', 'g', 'r', 'v0', 'alpha', 't1', 'c', 'a', 'f', 'l', 'h', 'beta', 'k', 'p', 'x0', 'Re', 'H'] as const;
export type SurfNumKey = (typeof SURF_NUM)[number];
const SURF_ASKS: SurfProblem['ask'][] = ['cyl', 'cone', 'rough', 'wire', 'chain', 'helix', 'alt'];
export const STAGE_NUM = ['m', 'g', 'r', 'alpha', 'h', 'f', 'vy', 'beta', 'H', 's', 'phi0', 'v0'] as const;
export type StageNumKey = (typeof STAGE_NUM)[number];
const STAGE_ASKS: StageProblem['ask'][] = ['loop', 'jump', 'plate', 'fly', 'slack'];
export const IMP_NUM = ['m', 'g', 'v0', 'v1', 't', 'F', 'f', 'alpha', 's', 'A', 'a0', 'a1', 'dt', 'v', 'T', 'psi', 'r1', 'n1', 'r2', 'R', 'u0', 'a', 'l1', 'l2'] as const;
export type ImpNumKey = (typeof IMP_NUM)[number];
const IMP_ASKS: ImpulseProblem['ask'][] = ['line', 'vec', 'circle', 'area', 'hole', 'sync'];
const IMP_FINDS: ImpulseProblem['find'][] = ['t', 'v1', 'F', 'f', 'm', 'tpath'];
/** Режимы пункта 21: числа и выбор вопроса правятся одинаково. */
export type SubMode = 'spin' | 'surf' | 'stages' | 'impulse';
type SubNum = { spin: SpinNumKey; surf: SurfNumKey; stages: StageNumKey; impulse: ImpNumKey };

export type PointMode = 'line' | 'first' | 'plane' | 'circle' | 'rel' | 'earth' | SubMode;
export interface PointTask {
  mode: PointMode;
  line: PointProblem;
  first: FirstProblem;
  plane: PlaneProblem;
  circle: CircleProblem;
  rel: RelProblem;
  earth: EarthDyn;
  spin: SpinProblem;
  surf: SurfProblem;
  stages: StageProblem;
  impulse: ImpulseProblem;
}
export type AnyPresetKey = PointPresetKey | FirstPresetKey | PlanePresetKey | CirclePresetKey | RelPresetKey | EarthPresetKey | SpinPresetKey | SurfPresetKey | StagePresetKey | ImpulsePresetKey;

export interface PointState {
  problem: PointTask;
  title: string;
  preset: AnyPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: PointTask;
  title: string;
  preset: PointState['preset'];
}
const copy = <T>(p: T): T => structuredClone(p);

const DEF_LINE = POINT_PRESETS.m277.problem as PointProblem;
const DEF_FIRST = FIRST_PRESETS.f2615.problem as FirstProblem;
const DEF_PLANE = PLANE_PRESETS.p2744.problem as PlaneProblem;
const DEF_CIRCLE = CIRCLE_PRESETS.c311.problem as CircleProblem;
const DEF_REL = REL_PRESETS.yd4.problem as RelProblem;
const DEF_EARTH = EARTH_PRESETS.d335.problem as EarthDyn;
const DEF_SPIN = SPIN_PRESETS.s269.problem as SpinProblem;
const DEF_SURF = SURF_PRESETS.u3120.problem as SurfProblem;
const DEF_STAGES = STAGE_PRESETS.g3111.problem as StageProblem;
const DEF_IMPULSE = IMPULSE_PRESETS.i281.problem as ImpulseProblem;
const defaults = () => ({ spin: copy(DEF_SPIN), surf: copy(DEF_SURF), stages: copy(DEF_STAGES), impulse: copy(DEF_IMPULSE) });

/** Задача по ключу готовой задачи: режим и данные этого режима. */
export function presetTask(k: AnyPresetKey, base?: PointTask): { task: PointTask; title: string } {
  const b: PointTask = base ? copy(base) : { mode: 'line', line: copy(DEF_LINE), first: copy(DEF_FIRST), plane: copy(DEF_PLANE), circle: copy(DEF_CIRCLE), rel: copy(DEF_REL), earth: copy(DEF_EARTH), ...defaults() };
  for (const [mode, rec] of [
    ['spin', SPIN_PRESETS],
    ['surf', SURF_PRESETS],
    ['stages', STAGE_PRESETS],
    ['impulse', IMPULSE_PRESETS],
  ] as [SubMode, Record<string, { title: string; problem: unknown }>][])
    if (k in rec) return { task: { ...b, mode, [mode]: copy(rec[k].problem) }, title: rec[k].title };
  if (k in POINT_PRESETS) return { task: { ...b, mode: 'line', line: copy(POINT_PRESETS[k as PointPresetKey].problem as PointProblem) }, title: POINT_PRESETS[k as PointPresetKey].title };
  if (k in FIRST_PRESETS) return { task: { ...b, mode: 'first', first: copy(FIRST_PRESETS[k as FirstPresetKey].problem as FirstProblem) }, title: FIRST_PRESETS[k as FirstPresetKey].title };
  if (k in CIRCLE_PRESETS) return { task: { ...b, mode: 'circle', circle: copy(CIRCLE_PRESETS[k as CirclePresetKey].problem as CircleProblem) }, title: CIRCLE_PRESETS[k as CirclePresetKey].title };
  if (k in EARTH_PRESETS) return { task: { ...b, mode: 'earth', earth: copy(EARTH_PRESETS[k as EarthPresetKey].problem as EarthDyn) }, title: EARTH_PRESETS[k as EarthPresetKey].title };
  if (k in REL_PRESETS) return { task: { ...b, mode: 'rel', rel: copy(REL_PRESETS[k as RelPresetKey].problem as RelProblem) }, title: REL_PRESETS[k as RelPresetKey].title };
  return { task: { ...b, mode: 'plane', plane: copy(PLANE_PRESETS[k as PlanePresetKey].problem as PlaneProblem) }, title: PLANE_PRESETS[k as PlanePresetKey].title };
}

function parseLine(raw: unknown): PointProblem | null {
  if (!isObj(raw) || !NUM_KEYS.every((k) => isNum(raw[k])) || !['t', 'v', 'x'].includes(raw.ask as string)) return null;
  const nums = Object.fromEntries(NUM_KEYS.map((k) => [k, raw[k]])) as Record<PointNumKey, number>;
  if (raw.form != null && typeof raw.form !== 'string') return null;
  return { ...nums, byWeight: raw.byWeight === true, up: raw.up === true, ask: raw.ask as PointProblem['ask'], ...(typeof raw.form === 'string' && raw.form.trim() ? { form: raw.form.slice(0, 200) } : {}) };
}
function parseFirst(raw: unknown): FirstProblem | null {
  if (!isObj(raw) || !FIRST_NUM.every((k) => isNum(raw[k])) || !['x', 'y', 'z'].every((k) => typeof raw[k] === 'string') || !['none', '-y', '+y', '-z', '+x', '-x'].includes(raw.gravity as string)) return null;
  const nums = Object.fromEntries(FIRST_NUM.map((k) => [k, raw[k]])) as Record<FirstNumKey, number>;
  return { ...nums, byWeight: raw.byWeight === true, x: (raw.x as string).slice(0, 200), y: (raw.y as string).slice(0, 200), z: (raw.z as string).slice(0, 200), gravity: raw.gravity as FirstProblem['gravity'] };
}
function parsePlane(raw: unknown): PlaneProblem | null {
  if (!isObj(raw) || !PLANE_NUM.every((k) => isNum(raw[k])) || !['t', 'land', 'apex', 'x'].includes(raw.ask as string)) return null;
  const nums = Object.fromEntries(PLANE_NUM.map((k) => [k, raw[k]])) as Record<PlaneNumKey, number>;
  if ((raw.formX != null && typeof raw.formX !== 'string') || (raw.formY != null && typeof raw.formY !== 'string')) return null;
  return {
    ...nums,
    byWeight: raw.byWeight === true,
    gravity: raw.gravity !== false,
    ask: raw.ask as PlaneProblem['ask'],
    ...(typeof raw.formX === 'string' && raw.formX.trim() ? { formX: raw.formX.slice(0, 200) } : {}),
    ...(typeof raw.formY === 'string' && raw.formY.trim() ? { formY: raw.formY.slice(0, 200) } : {}),
  };
}

function parseCircle(raw: unknown): CircleProblem | null {
  if (!isObj(raw) || !CIRCLE_NUM.every((k) => isNum(raw[k])) || !LINKS.includes(raw.link as CircleProblem['link']) || !['at', 'detach', 'full'].includes(raw.ask as string)) return null;
  const nums = Object.fromEntries(CIRCLE_NUM.map((k) => [k, raw[k]])) as Record<CircleNumKey, number>;
  return { ...nums, byWeight: raw.byWeight === true, spring: raw.spring === true, link: raw.link as CircleProblem['link'], ask: raw.ask as CircleProblem['ask'] };
}

function parseRel(raw: unknown): RelProblem | null {
  if (!isObj(raw) || !REL_NUM.every((k) => isNum(raw[k])) || !FRAMES.includes(raw.frame as RelProblem['frame']) || !['t', 'x'].includes(raw.ask as string)) return null;
  if (typeof raw.y1 !== 'string' || typeof raw.z1 !== 'string' || (raw.form != null && typeof raw.form !== 'string')) return null;
  const nums = Object.fromEntries(REL_NUM.map((k) => [k, raw[k]])) as Record<RelNumKey, number>;
  return {
    ...nums,
    byWeight: raw.byWeight === true,
    frame: raw.frame as RelProblem['frame'],
    y1: raw.y1.slice(0, 200),
    z1: raw.z1.slice(0, 200),
    ask: raw.ask as RelProblem['ask'],
    ...(typeof raw.form === 'string' && raw.form.trim() ? { form: raw.form.slice(0, 200) } : {}),
  };
}

function parseEarth(raw: unknown): EarthDyn | null {
  if (!isObj(raw) || !EARTH_NUM.every((k) => isNum(raw[k])) || !ASKS.includes(raw.ask as EarthDyn['ask'])) return null;
  const nums = Object.fromEntries(EARTH_NUM.map((k) => [k, raw[k]])) as Record<EarthNumKey, number>;
  return { ...nums, byWeight: raw.byWeight === true, ask: raw.ask as EarthDyn['ask'] };
}

function nums<K extends string>(raw: Record<string, unknown>, keys: readonly K[]): Record<K, number> | null {
  if (!keys.every((k) => isNum(raw[k]))) return null;
  return Object.fromEntries(keys.map((k) => [k, raw[k]])) as Record<K, number>;
}
function parseSpin(raw: unknown): SpinProblem | null {
  if (!isObj(raw) || !Object.keys(FINDS).includes(raw.ask as string) || !FINDS[raw.ask as SpinProblem['ask']].includes(raw.find as string)) return null;
  const n = nums(raw, SPIN_NUM);
  return n && { ...n, byWeight: raw.byWeight === true, ask: raw.ask as SpinProblem['ask'], find: raw.find as string };
}
function parseSurf(raw: unknown): SurfProblem | null {
  if (!isObj(raw) || !SURF_ASKS.includes(raw.ask as SurfProblem['ask']) || !['outer', 'inner'].includes(raw.side as string)) return null;
  const n = nums(raw, SURF_NUM);
  return n && { ...n, byWeight: raw.byWeight === true, grav: raw.grav !== false, ask: raw.ask as SurfProblem['ask'], side: raw.side as SurfProblem['side'] };
}
function parseStages(raw: unknown): StageProblem | null {
  if (!isObj(raw) || !STAGE_ASKS.includes(raw.ask as StageProblem['ask'])) return null;
  const n = nums(raw, STAGE_NUM);
  return n && { ...n, byWeight: raw.byWeight === true, ask: raw.ask as StageProblem['ask'] };
}
function parseImpulse(raw: unknown): ImpulseProblem | null {
  if (!isObj(raw) || !IMP_ASKS.includes(raw.ask as ImpulseProblem['ask']) || !IMP_FINDS.includes(raw.find as ImpulseProblem['find'])) return null;
  const n = nums(raw, IMP_NUM);
  return n && { ...n, byWeight: raw.byWeight === true, ask: raw.ask as ImpulseProblem['ask'], find: raw.find as ImpulseProblem['find'] };
}

export function parsePoint(raw: unknown): { ok: true; problem: PointTask } | { ok: false; errors: string[] } {
  // Файл первой версии раздела — только прямолинейное движение.
  const old = parseLine(raw);
  if (old) return { ok: true, problem: { mode: 'line', line: old, first: copy(DEF_FIRST), plane: copy(DEF_PLANE), circle: copy(DEF_CIRCLE), rel: copy(DEF_REL), earth: copy(DEF_EARTH), ...defaults() } };
  if (!isObj(raw) || !['line', 'first', 'plane', 'circle', 'rel', 'earth', 'spin', 'surf', 'stages', 'impulse'].includes(raw.mode as string)) return { ok: false, errors: ['В файле нет задачи (problem с полем mode).'] };
  const line = parseLine(raw.line),
    first = parseFirst(raw.first),
    plane = parsePlane(raw.plane),
    circle = parseCircle(raw.circle),
    rel = parseRel(raw.rel),
    earth = parseEarth(raw.earth),
    spin = parseSpin(raw.spin),
    surf = parseSurf(raw.surf),
    stages = parseStages(raw.stages),
    impulse = parseImpulse(raw.impulse);
  const need = { line, first, plane, circle, rel, earth, spin, surf, stages, impulse }[raw.mode as PointMode];
  if (!need) return { ok: false, errors: ['Данные задачи неполные.'] };
  // Файлы до режимов «движение по окружности», «относительное движение», «вращение Земли» и режимов пункта 21 — без этих полей.
  return {
    ok: true,
    problem: { mode: raw.mode as PointMode, line: line ?? copy(DEF_LINE), first: first ?? copy(DEF_FIRST), plane: plane ?? copy(DEF_PLANE), circle: circle ?? copy(DEF_CIRCLE), rel: rel ?? copy(DEF_REL),
      earth: earth ?? copy(DEF_EARTH),
      spin: spin ?? copy(DEF_SPIN),
      surf: surf ?? copy(DEF_SURF),
      stages: stages ?? copy(DEF_STAGES),
      impulse: impulse ?? copy(DEF_IMPULSE),
    },
  };
}

export class PointStore {
  private st: PointState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: AnyPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm277';
    const { task, title } = presetTask(k);
    this.st = { problem: task, title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
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
  private edit(fn: (p: PointTask) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  loadPreset = (k: AnyPresetKey) => {
    this.commit();
    const { task, title } = presetTask(k, this.st.problem);
    this.set({ problem: task, title, preset: k });
  };
  setMode = (mode: PointMode) => {
    if (mode === this.st.problem.mode) return;
    this.commit();
    this.edit((p) => (p.mode = mode));
  };
  /* прямолинейное движение */
  typeNum = (key: PointNumKey, v: number) => {
    this.touch(`n:${key}`);
    this.edit((p) => (p.line[key] = v));
  };
  setUp = (up: boolean) => {
    this.commit();
    this.edit((p) => (p.line.up = up));
  };
  setByWeight = (on: boolean) => {
    this.commit();
    this.edit((p) => (p[p.mode].byWeight = on));
  };
  /** Сила-формула F(t, x, v) (пустая строка — убрать). */
  typeForm = (s: string) => {
    this.touch('n:form');
    this.edit((p) => {
      if (s.trim()) p.line.form = s.slice(0, 200);
      else delete p.line.form;
    });
  };
  setAsk = (ask: PointProblem['ask']) => {
    this.commit();
    this.edit((p) => (p.line.ask = ask));
  };
  /* первая задача */
  typeFirst = (key: FirstNumKey, v: number) => {
    this.touch(`f:${key}`);
    this.edit((p) => (p.first[key] = v));
  };
  typeLaw = (key: 'x' | 'y' | 'z', s: string) => {
    this.touch(`f:${key}`);
    this.edit((p) => (p.first[key] = s.slice(0, 200)));
  };
  setGravityDir = (g: FirstProblem['gravity']) => {
    this.commit();
    this.edit((p) => (p.first.gravity = g));
  };
  /* движение в плоскости */
  typePlane = (key: PlaneNumKey, v: number) => {
    this.touch(`q:${key}`);
    this.edit((p) => (p.plane[key] = v));
  };
  /** Составляющие силы формулами (пустая строка — убрать). */
  typePlaneForm = (key: 'formX' | 'formY', s: string) => {
    this.touch(`q:${key}`);
    this.edit((p) => {
      if (s.trim()) p.plane[key] = s.slice(0, 200);
      else delete p.plane[key];
    });
  };
  setPlaneGravity = (on: boolean) => {
    this.commit();
    this.edit((p) => (p.plane.gravity = on));
  };
  setPlaneAsk = (ask: PlaneProblem['ask']) => {
    this.commit();
    this.edit((p) => (p.plane.ask = ask));
  };
  /* движение по окружности */
  typeCircle = (key: CircleNumKey, v: number) => {
    this.touch(`o:${key}`);
    this.edit((p) => (p.circle[key] = v));
  };
  setCircleLink = (link: CircleProblem['link']) => {
    this.commit();
    this.edit((p) => (p.circle.link = link));
  };
  setCircleSpring = (on: boolean) => {
    this.commit();
    this.edit((p) => (p.circle.spring = on));
  };
  setCircleAsk = (ask: CircleProblem['ask']) => {
    this.commit();
    this.edit((p) => (p.circle.ask = ask));
  };
  /* относительное движение в трубке */
  typeRel = (key: RelNumKey, v: number) => {
    this.touch(`r:${key}`);
    this.edit((p) => (p.rel[key] = v));
  };
  /** Законы поступательного движения тела и сила-формула (пустая строка у формы — убрать). */
  typeRelLaw = (key: 'y1' | 'z1' | 'form', s: string) => {
    this.touch(`r:${key}`);
    this.edit((p) => {
      if (key !== 'form') p.rel[key] = s.slice(0, 200);
      else if (s.trim()) p.rel.form = s.slice(0, 200);
      else delete p.rel.form;
    });
  };
  setRelFrame = (frame: RelProblem['frame']) => {
    this.commit();
    this.edit((p) => (p.rel.frame = frame));
  };
  setRelAsk = (ask: RelProblem['ask']) => {
    this.commit();
    this.edit((p) => (p.rel.ask = ask));
  };
  /* движение вблизи вращающейся Земли */
  typeEarth = (key: EarthNumKey, v: number) => {
    this.touch(`e:${key}`);
    this.edit((p) => (p.earth[key] = v));
  };
  setEarthAsk = (ask: EarthDyn['ask']) => {
    this.commit();
    this.edit((p) => (p.earth.ask = ask));
  };
  /* режимы пункта 21: вращение, поверхности, составные задачи, импульс */
  typeSub = <M extends SubMode>(mode: M, key: SubNum[M], v: number) => {
    this.touch(`${mode}:${key}`);
    this.edit((p) => ((p[mode] as unknown as Record<string, number>)[key] = v));
  };
  /** Выбор вопроса и переключатели; при смене вопроса «что ищем» — первый допустимый вариант. */
  setSub = <M extends SubMode>(mode: M, patch: Partial<PointTask[M]>) => {
    this.commit();
    this.edit((p) => {
      Object.assign(p[mode], patch);
      if (mode === 'spin' && 'ask' in patch) {
        const sp = p.spin;
        if (!FINDS[sp.ask].includes(sp.find)) sp.find = FINDS[sp.ask][0];
      }
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
