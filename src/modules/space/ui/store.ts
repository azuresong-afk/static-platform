/** Состояние вкладки «Пространственный брус»: брус, нагрузки, сечение, история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { Axis, Frame3, Load3, Seg3 } from '../model/frame3d';
import { SPACE_PRESETS, type SpacePresetKey } from '../presets';

export const SPACE_MODULE = 'space3';
const MAX_SEGS = 6;
const AXES = ['x', 'y', 'z'];

export interface SpaceState {
  frame: Frame3;
  title: string;
  preset: SpacePresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}

interface Snap {
  frame: Frame3;
  title: string;
  preset: SpaceState['preset'];
}

/** Проверка бруса из файла. */
export function parseFrame(raw: unknown): { ok: true; frame: Frame3 } | { ok: false; errors: string[] } {
  if (!isObj(raw)) return { ok: false, errors: ['В файле нет бруса (frame).'] };
  const errors: string[] = [];
  const segs: Seg3[] = [];
  if (!Array.isArray(raw.segs) || !raw.segs.length || raw.segs.length > MAX_SEGS) errors.push(`Участков должно быть от 1 до ${MAX_SEGS}.`);
  else
    raw.segs.forEach((s: unknown, i: number) => {
      if (!isObj(s) || !AXES.includes(s.axis as string) || (s.sign !== 1 && s.sign !== -1) || !isNum(s.l) || s.l <= 0) errors.push(`Участок №${i + 1}: ось x, y или z, направление ±1, длина — положительное число.`);
      else segs.push({ axis: s.axis as Axis, sign: s.sign, l: s.l });
    });
  const loads: Load3[] = [];
  if (!Array.isArray(raw.loads)) errors.push('Нет списка нагрузок (loads).');
  else
    raw.loads.forEach((l: unknown, i: number) => {
      const bad = () => errors.push(`Нагрузка №${i + 1}: неверные данные.`);
      if (!isObj(l) || !AXES.includes(l.axis as string) || !isNum(l.v)) return bad();
      if ((l.kind === 'P' || l.kind === 'M') && Number.isInteger(l.node) && (l.node as number) >= 1 && (l.node as number) <= segs.length) loads.push({ kind: l.kind, node: l.node as number, axis: l.axis as Axis, v: l.v });
      else if (l.kind === 'q' && Number.isInteger(l.seg) && (l.seg as number) >= 0 && (l.seg as number) < segs.length) loads.push({ kind: 'q', seg: l.seg as number, axis: l.axis as Axis, v: l.v });
      else bad();
    });
  if (raw.section !== 'circle' && raw.section !== 'ring') errors.push('Сечение: ожидается circle или ring.');
  if (!isNum(raw.c) || raw.c <= 0 || raw.c >= 1) errors.push('d/D кольца должно быть от 0 до 1.');
  if (!isNum(raw.sigma) || raw.sigma <= 0) errors.push('[σ] должно быть положительным числом.');
  if (raw.hyp !== 3 && raw.hyp !== 4) errors.push('Гипотеза прочности: 3 или 4.');
  if (errors.length) return { ok: false, errors };
  return { ok: true, frame: { segs, loads, section: raw.section as Frame3['section'], c: raw.c as number, sigma: raw.sigma as number, hyp: raw.hyp as 3 | 4 } };
}

export class SpaceStore {
  private st: SpaceState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();

  constructor(opts: { preset?: SpacePresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 's16';
    this.st = { frame: SPACE_PRESETS[k].frame, title: SPACE_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }

  get = (): SpaceState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<SpaceState>) {
    this.st = { ...this.st, ...patch, canUndo: this.hist.canUndo, canRedo: this.hist.canRedo };
    this.listeners.forEach((f) => f());
  }
  private snap = (): Snap => ({ frame: this.st.frame, title: this.st.title, preset: this.st.preset });
  private commit() {
    this.hist.push(this.snap());
    if (this.st.preset !== 'custom') this.st = { ...this.st, preset: 'custom', title: 'Свой брус' };
  }
  private touch(key: string) {
    if (this.hist.startSession(key)) this.commit();
  }
  endSession = (key: string) => this.hist.endSession(key);
  private setFrame(frame: Frame3) {
    this.set({ frame });
  }

  loadPreset = (k: SpacePresetKey) => {
    this.commit();
    this.set({ frame: SPACE_PRESETS[k].frame, title: SPACE_PRESETS[k].title, preset: k });
  };
  /** Направление участка: ось и знак (±x, ±y, ±z). */
  setSegDir = (i: number, axis: Axis, sign: 1 | -1) => {
    this.commit();
    this.setFrame({ ...this.st.frame, segs: this.st.frame.segs.map((s, j) => (j === i ? { ...s, axis, sign } : s)) });
  };
  typeSegLen = (i: number, l: number) => {
    this.touch(`seg:${i}`);
    this.setFrame({ ...this.st.frame, segs: this.st.frame.segs.map((s, j) => (j === i ? { ...s, l } : s)) });
  };
  addSeg = () => {
    const f = this.st.frame;
    if (f.segs.length >= MAX_SEGS) return;
    const last = f.segs[f.segs.length - 1];
    const axis: Axis = last.axis === 'x' ? 'y' : 'x';
    this.commit();
    this.setFrame({ ...f, segs: [...f.segs, { axis, sign: 1, l: 1 }] });
  };
  /** Убрать последний участок и нагрузки на нём и в его конце. */
  removeSeg = () => {
    const f = this.st.frame;
    if (f.segs.length <= 1) return;
    const n = f.segs.length;
    this.commit();
    this.setFrame({ ...f, segs: f.segs.slice(0, -1), loads: f.loads.filter((l) => (l.kind === 'q' ? l.seg < n - 1 : l.node < n)) });
  };
  addLoad = (kind: Load3['kind']) => {
    const f = this.st.frame;
    const n = f.segs.length;
    const ld: Load3 = kind === 'q' ? { kind, seg: n - 1, axis: 'z', v: -10 } : { kind, node: n, axis: 'z', v: kind === 'P' ? -10 : 10 };
    this.commit();
    this.setFrame({ ...f, loads: [...f.loads, ld] });
  };
  removeLoad = (i: number) => {
    this.commit();
    this.setFrame({ ...this.st.frame, loads: this.st.frame.loads.filter((_, j) => j !== i) });
  };
  /** Где приложена нагрузка, ось и знак направления. */
  setLoad = (i: number, patch: Partial<{ where: number; axis: Axis; dir: 1 | -1 }>) => {
    this.commit();
    const loads = this.st.frame.loads.map((l, j) => {
      if (j !== i) return l;
      const mag = Math.abs(l.v) * (patch.dir ?? (l.v < 0 ? -1 : 1));
      const next = { ...l, axis: patch.axis ?? l.axis, v: mag } as Load3;
      if (patch.where !== undefined) {
        if (next.kind === 'q') next.seg = patch.where;
        else next.node = patch.where;
      }
      return next;
    });
    this.setFrame({ ...this.st.frame, loads });
  };
  /** Величина нагрузки (модуль); знак — направление. */
  typeLoadValue = (i: number, mag: number) => {
    this.touch(`load:${i}`);
    this.setFrame({ ...this.st.frame, loads: this.st.frame.loads.map((l, j) => (j === i ? ({ ...l, v: (l.v < 0 ? -1 : 1) * mag } as Load3) : l)) });
  };
  typeField = (key: 'c' | 'sigma', v: number) => {
    this.touch(key);
    this.setFrame({ ...this.st.frame, [key]: v });
  };
  setField = <K extends 'section' | 'hyp'>(key: K, v: Frame3[K]) => {
    if (this.st.frame[key] === v) return;
    this.commit();
    this.setFrame({ ...this.st.frame, [key]: v });
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

  exportProject = (now = new Date()): { name: string; text: string } => ({
    name: projectFileName(this.st.title, now),
    text: writeEnvelope(SPACE_MODULE, this.st.title, { frame: this.st.frame }, now),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== SPACE_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseFrame(env.raw.frame);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Брус';
    this.set({ frame: r.frame, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
