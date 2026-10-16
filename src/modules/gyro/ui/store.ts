/** Состояние вкладки «Гироскоп»: задача приближённой теории гироскопов; история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { BalMode, GyroMode, GyroProblem, JMode, PrecMode, SpinMode, SrcMode, StatMode, SupMode, Units } from '../model/gyro';
import { GYRO_PRESETS, type GyroPresetKey } from '../presets';

export const GYRO_MODULE = 'gyro';
export const GYRO_NUM = [
  'g',
  'm',
  'J',
  'rho',
  'R',
  'H',
  'om',
  'v',
  'a',
  'd',
  'rc',
  'w1',
  'vp',
  'Rp',
  'amp',
  'T',
  'beta',
  'l',
  'P',
  'c',
  'e',
  'l0',
  'F',
  'h',
  'M0',
  'cs',
  'as',
  'ns',
  'Ob',
  'gam',
  'Hst',
] as const;
export type GyroNumKey = (typeof GYRO_NUM)[number];
export type GyroSel = 'mode' | 'units' | 'jMode' | 'spin' | 'prec' | 'sup' | 'stat' | 'src' | 'bal';
export const GYRO_SEL: Record<GyroSel, readonly string[]> = {
  mode: ['forced', 'free', 'balance'] satisfies GyroMode[],
  units: ['si', 'tech'] satisfies Units[],
  jMode: ['J', 'rho', 'disc', 'ring', 'H'] satisfies JMode[],
  spin: ['rate', 'rpm', 'roll', 'runner'] satisfies SpinMode[],
  prec: ['rate', 'rpm', 'degs', 'turn', 'pitch'] satisfies PrecMode[],
  sup: ['rotor', 'prec', 'roller'] satisfies SupMode[],
  stat: ['none', 'split', 'lever', 'weight'] satisfies StatMode[],
  src: ['weight', 'force', 'moment'] satisfies SrcMode[],
  bal: ['spring', 'pendulum'] satisfies BalMode[],
};

export interface GyroStoreState {
  problem: GyroProblem;
  title: string;
  preset: GyroPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: GyroProblem;
  title: string;
  preset: GyroStoreState['preset'];
}
const copy = <T>(p: T): T => structuredClone(p);

export function parseGyro(raw: unknown): { ok: true; problem: GyroProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw)) return { ok: false, errors: ['В файле нет задачи.'] };
  if (!GYRO_NUM.every((k) => isNum(raw[k]))) return { ok: false, errors: ['Данные задачи неполные.'] };
  for (const [k, vals] of Object.entries(GYRO_SEL)) if (!vals.includes(raw[k] as string)) return { ok: false, errors: ['Данные задачи неполные.'] };
  const nums = Object.fromEntries(GYRO_NUM.map((k) => [k, raw[k]])) as Record<GyroNumKey, number>;
  const sel = Object.fromEntries(Object.keys(GYRO_SEL).map((k) => [k, raw[k]])) as Pick<GyroProblem, GyroSel>;
  return { ok: true, problem: { ...nums, ...sel } };
}

export class GyroStore {
  private st: GyroStoreState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: GyroPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm408';
    this.st = {
      problem: copy(GYRO_PRESETS[k].problem),
      title: GYRO_PRESETS[k].title,
      preset: k,
      canUndo: false,
      canRedo: false,
      notice: null,
      explain: opts.explain ?? true,
    };
  }
  get = (): GyroStoreState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<GyroStoreState>) {
    this.st = { ...this.st, ...patch, canUndo: this.hist.canUndo, canRedo: this.hist.canRedo };
    this.listeners.forEach((f) => f());
  }
  private snap = (): Snap => ({ problem: this.st.problem, title: this.st.title, preset: this.st.preset });
  private commit() {
    this.hist.push(this.snap());
    if (this.st.preset !== 'custom') this.st = { ...this.st, preset: 'custom', title: 'Своя задача' };
  }
  endSession = (key: string) => this.hist.endSession(key);
  loadPreset = (k: GyroPresetKey) => {
    this.commit();
    this.set({ problem: copy(GYRO_PRESETS[k].problem), title: GYRO_PRESETS[k].title, preset: k });
  };
  type = (key: GyroNumKey, v: number) => {
    if (this.hist.startSession(`g:${key}`)) this.commit();
    this.set({ problem: { ...this.st.problem, [key]: v } });
  };
  setSel = <K extends GyroSel>(key: K, v: GyroProblem[K]) => {
    if (this.st.problem[key] === v) return;
    this.commit();
    const p = { ...this.st.problem, [key]: v };
    // Бегун на основании — опора «бегун», и наоборот; кинетический момент сразу — только для прецессии под моментом.
    if (key === 'spin' && v === 'runner') p.sup = 'roller';
    if (key === 'jMode' && v === 'H' && p.mode !== 'free') p.mode = 'free';
    if (key === 'mode' && v !== 'free' && p.jMode === 'H') p.jMode = 'J';
    if (key === 'mode' && v !== 'forced' && p.spin === 'runner') p.spin = 'rpm';
    if (key === 'spin' && v !== 'runner' && p.sup === 'roller' && p.d <= 0) p.d = 1;
    // Статические давления — по типу опор.
    const allowed = p.sup === 'roller' ? ['none', 'weight'] : p.sup === 'rotor' ? ['none', 'split'] : ['none', 'lever'];
    if (!allowed.includes(p.stat)) p.stat = 'none';
    this.set({ problem: p });
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
    text: writeEnvelope(GYRO_MODULE, this.st.title, { problem: this.st.problem }, now),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== GYRO_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseGyro(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Гироскоп';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
