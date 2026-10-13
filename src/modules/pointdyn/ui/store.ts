/**
 * Состояние вкладки «Динамика точки»: пять режимов — прямолинейное движение (вторая задача),
 * силы по заданному движению (первая задача), криволинейное движение в плоскости, движение по окружности
 * (реакция связи, отрыв) и относительное движение в трубке подвижного тела; история отмены, файл проекта.
 */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { CircleProblem } from '../model/circle';
import type { FirstProblem } from '../model/first';
import type { PlaneProblem } from '../model/plane';
import type { PointProblem } from '../model/point';
import type { RelProblem } from '../model/rel';
import {
  CIRCLE_PRESETS,
  FIRST_PRESETS,
  PLANE_PRESETS,
  POINT_PRESETS,
  REL_PRESETS,
  type CirclePresetKey,
  type FirstPresetKey,
  type PlanePresetKey,
  type PointPresetKey,
  type RelPresetKey,
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

export type PointMode = 'line' | 'first' | 'plane' | 'circle' | 'rel';
export interface PointTask {
  mode: PointMode;
  line: PointProblem;
  first: FirstProblem;
  plane: PlaneProblem;
  circle: CircleProblem;
  rel: RelProblem;
}
export type AnyPresetKey = PointPresetKey | FirstPresetKey | PlanePresetKey | CirclePresetKey | RelPresetKey;

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

/** Задача по ключу готовой задачи: режим и данные этого режима. */
export function presetTask(k: AnyPresetKey, base?: PointTask): { task: PointTask; title: string } {
  const b: PointTask = base ? copy(base) : { mode: 'line', line: copy(DEF_LINE), first: copy(DEF_FIRST), plane: copy(DEF_PLANE), circle: copy(DEF_CIRCLE), rel: copy(DEF_REL) };
  if (k in POINT_PRESETS) return { task: { ...b, mode: 'line', line: copy(POINT_PRESETS[k as PointPresetKey].problem as PointProblem) }, title: POINT_PRESETS[k as PointPresetKey].title };
  if (k in FIRST_PRESETS) return { task: { ...b, mode: 'first', first: copy(FIRST_PRESETS[k as FirstPresetKey].problem as FirstProblem) }, title: FIRST_PRESETS[k as FirstPresetKey].title };
  if (k in CIRCLE_PRESETS) return { task: { ...b, mode: 'circle', circle: copy(CIRCLE_PRESETS[k as CirclePresetKey].problem as CircleProblem) }, title: CIRCLE_PRESETS[k as CirclePresetKey].title };
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

export function parsePoint(raw: unknown): { ok: true; problem: PointTask } | { ok: false; errors: string[] } {
  // Файл первой версии раздела — только прямолинейное движение.
  const old = parseLine(raw);
  if (old) return { ok: true, problem: { mode: 'line', line: old, first: copy(DEF_FIRST), plane: copy(DEF_PLANE), circle: copy(DEF_CIRCLE), rel: copy(DEF_REL) } };
  if (!isObj(raw) || !['line', 'first', 'plane', 'circle', 'rel'].includes(raw.mode as string)) return { ok: false, errors: ['В файле нет задачи (problem с полем mode).'] };
  const line = parseLine(raw.line),
    first = parseFirst(raw.first),
    plane = parsePlane(raw.plane),
    circle = parseCircle(raw.circle),
    rel = parseRel(raw.rel);
  const need = { line, first, plane, circle, rel }[raw.mode as PointMode];
  if (!need) return { ok: false, errors: ['Данные задачи неполные.'] };
  // Файлы до режимов «движение по окружности» и «относительное движение» — без полей circle, rel.
  return {
    ok: true,
    problem: { mode: raw.mode as PointMode, line: line ?? copy(DEF_LINE), first: first ?? copy(DEF_FIRST), plane: plane ?? copy(DEF_PLANE), circle: circle ?? copy(DEF_CIRCLE), rel: rel ?? copy(DEF_REL) },
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
