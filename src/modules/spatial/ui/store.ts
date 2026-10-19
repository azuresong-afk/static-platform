/** Состояние вкладки «Пространственное движение»: задача, история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { V3 } from '../../converging/model/forces';
import type { ComposeProblem, SPoint } from '../model/compose';
import type { DiffProblem } from '../model/diff';
import type { EulerProblem } from '../model/euler';
import type { GyroProblem } from '../model/gyro';
import type { Rot, ScrewProblem, Trans } from '../model/screw';
import { defaultState, SP_PRESETS, type SpMode, type SpPresetKey, type SpState } from '../presets';

export const SPATIAL_MODULE = 'spatial';
export const MAX_POINTS = 6;
export const MAX_ROTS = 6;
const MODES: SpMode[] = ['compose', 'euler', 'diff', 'screw', 'gyro'];

export interface SpViewState {
  problem: SpState;
  title: string;
  preset: SpPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: SpState;
  title: string;
  preset: SpViewState['preset'];
}
const copy = <T>(x: T): T => structuredClone(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const nums = (o: Record<string, unknown>, keys: string[]) => keys.every((k) => isNum(o[k]));
const isV3 = (x: unknown): x is V3 => Array.isArray(x) && x.length === 3 && x.every(isNum);
const oneOf = <T extends string>(x: unknown, xs: readonly T[]): x is T => xs.includes(x as T);

function parsePoints(raw: unknown): SPoint[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_POINTS) return null;
  const out: SPoint[] = [];
  for (const p of raw) {
    if (!isObj(p) || !isStr(p.name) || !nums(p, ['x', 'y', 'z'])) return null;
    out.push({ name: p.name.slice(0, 12), x: p.x as number, y: p.y as number, z: p.z as number });
  }
  return out;
}
function parseCompose(raw: unknown): ComposeProblem | null {
  if (
    !isObj(raw) ||
    !oneOf(raw.unit, ['rad', 'rpm'] as const) ||
    !oneOf(raw.scale, ['we', 'period', 'point'] as const) ||
    !oneOf(raw.rel, ['given', 'roll'] as const)
  )
    return null;
  if (!nums(raw, ['we', 'T', 'pi', 'vp', 'ee', 'alpha', 'wr', 'er', 'gamma'])) return null;
  const points = parsePoints(raw.points);
  if (!points) return null;
  const n = (k: string) => raw[k] as number;
  return {
    unit: raw.unit,
    scale: raw.scale,
    we: n('we'),
    T: n('T'),
    pi: n('pi'),
    vp: n('vp'),
    ee: n('ee'),
    alpha: n('alpha'),
    rel: raw.rel,
    wr: n('wr'),
    er: n('er'),
    gamma: n('gamma'),
    points,
  };
}
function parseEuler(raw: unknown): EulerProblem | null {
  if (!isObj(raw) || !isStr(raw.seq) || !isNum(raw.t1) || !isV3(raw.point)) return null;
  if (!Array.isArray(raw.names) || raw.names.length !== 3 || !raw.names.every(isStr)) return null;
  if (!Array.isArray(raw.laws) || raw.laws.length !== 3 || !raw.laws.every(isStr)) return null;
  return {
    seq: raw.seq.slice(0, 3),
    names: raw.names.map((s: string) => s.slice(0, 12)) as [string, string, string],
    laws: raw.laws.map((s: string) => s.slice(0, 200)) as [string, string, string],
    t1: raw.t1,
    point: raw.point,
  };
}
function parseDiff(raw: unknown): DiffProblem | null {
  if (
    !isObj(raw) ||
    !nums(raw, ['R1', 'r1', 'R2', 'r2', 'w1', 'w2', 'wH', 'd']) ||
    !oneOf(raw.sign, ['opp', 'same'] as const) ||
    !oneOf(raw.unknown, ['H', '1', '2'] as const)
  )
    return null;
  const c = raw.car;
  if (!isObj(c) || typeof c.on !== 'boolean' || !nums(c, ['v', 'rho', 'l', 'Rw'])) return null;
  const n = (k: string) => raw[k] as number;
  return {
    R1: n('R1'),
    r1: n('r1'),
    R2: n('R2'),
    r2: n('r2'),
    sign: raw.sign,
    unknown: raw.unknown,
    w1: n('w1'),
    w2: n('w2'),
    wH: n('wH'),
    d: n('d'),
    car: { on: c.on, v: c.v as number, rho: c.rho as number, l: c.l as number, Rw: c.Rw as number },
  };
}
function parseScrew(raw: unknown): ScrewProblem | null {
  if (!isObj(raw) || !Array.isArray(raw.rots) || !Array.isArray(raw.trans) || !isV3(raw.O) || raw.rots.length > MAX_ROTS || raw.trans.length > MAX_ROTS)
    return null;
  const rots: Rot[] = [];
  for (const r of raw.rots) {
    if (!isObj(r) || !isStr(r.name) || !isV3(r.p) || !isV3(r.d) || !isNum(r.w)) return null;
    rots.push({ name: r.name.slice(0, 12), p: r.p, d: r.d, w: r.w });
  }
  const trans: Trans[] = [];
  for (const t of raw.trans) {
    if (!isObj(t) || !isStr(t.name) || !isV3(t.v)) return null;
    trans.push({ name: t.name.slice(0, 12), v: t.v });
  }
  const points = parsePoints(raw.points);
  if (!points) return null;
  return { rots, trans, O: raw.O, points };
}
const GYRO_NUM = ['J', 'P', 'rho', 'r', 'g', 'w', 'dRoll', 'Rroll', 'Om', 'v', 'Rc', 'amp', 'T', 'beta', 'l', 'N0', 'F', 'h', 'c', 'a'] as const;
function parseGyro(raw: unknown): GyroProblem | null {
  if (!isObj(raw) || !nums(raw, [...GYRO_NUM]) || typeof raw.one !== 'boolean') return null;
  if (
    !oneOf(raw.jMode, ['J', 'Prho', 'disc', 'ring'] as const) ||
    !oneOf(raw.spin, ['rad', 'rpm', 'roll'] as const) ||
    !oneOf(raw.task, ['forced', 'precession', 'spring'] as const) ||
    !oneOf(raw.omMode, ['rad', 'rpm', 'deg', 'curve', 'pitch'] as const)
  )
    return null;
  const n = Object.fromEntries(GYRO_NUM.map((k) => [k, raw[k] as number])) as Record<(typeof GYRO_NUM)[number], number>;
  return { ...n, jMode: raw.jMode, spin: raw.spin, task: raw.task, omMode: raw.omMode, one: raw.one };
}

export function parseSpatial(raw: unknown): { ok: true; problem: SpState } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !oneOf(raw.mode, MODES)) return { ok: false, errors: ['В файле нет задачи (problem с полем mode).'] };
  const def = defaultState();
  const parts = {
    compose: parseCompose(raw.compose),
    euler: parseEuler(raw.euler),
    diff: parseDiff(raw.diff),
    screw: parseScrew(raw.screw),
    gyro: parseGyro(raw.gyro),
  };
  if (!parts[raw.mode]) return { ok: false, errors: ['Данные задачи неполные или неверные.'] };
  return {
    ok: true,
    problem: {
      mode: raw.mode,
      compose: parts.compose ?? def.compose,
      euler: parts.euler ?? def.euler,
      diff: parts.diff ?? def.diff,
      screw: parts.screw ?? def.screw,
      gyro: parts.gyro ?? def.gyro,
    },
  };
}

export class SpStore {
  private st: SpViewState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: SpPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm1905';
    this.st = {
      problem: copy(SP_PRESETS[k].problem),
      title: SP_PRESETS[k].title,
      preset: k,
      canUndo: false,
      canRedo: false,
      notice: null,
      explain: opts.explain ?? true,
    };
  }
  get = (): SpViewState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<SpViewState>) {
    this.st = { ...this.st, ...patch, canUndo: this.hist.canUndo, canRedo: this.hist.canRedo };
    this.listeners.forEach((f) => f());
  }
  private snap = (): Snap => ({ problem: this.st.problem, title: this.st.title, preset: this.st.preset });
  private commit() {
    this.hist.push(this.snap());
    if (this.st.preset !== 'custom') this.st = { ...this.st, preset: 'custom', title: 'Своя задача' };
  }
  private apply(fn: (p: SpState) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  /** Ввод в поле: правки одного поля подряд — одна запись истории. */
  type = (key: string, fn: (p: SpState) => void) => {
    if (this.hist.startSession(key)) this.commit();
    this.apply(fn);
  };
  endSession = (key: string) => this.hist.endSession(key);
  /** Однократное действие: выбор, добавление, удаление. */
  act = (fn: (p: SpState) => void) => {
    this.commit();
    this.apply(fn);
  };
  loadPreset = (k: SpPresetKey) => {
    this.commit();
    this.set({ problem: copy(SP_PRESETS[k].problem), title: SP_PRESETS[k].title, preset: k });
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
    text: writeEnvelope(SPATIAL_MODULE, this.st.title, { problem: this.st.problem }, now),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== SPATIAL_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseSpatial(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Пространственное движение';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
