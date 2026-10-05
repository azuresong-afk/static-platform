/** Состояние вкладки «Кручение»: вал, история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { Shaft, ShaftStep } from '../model/shaft';
import { TORSION_PRESETS, type TorsionPresetKey } from '../presets';

export const TORSION_MODULE = 'torsion';
const MAX_STEPS = 10;
export type TorsionNumKey = 'G' | 'd' | 'tauAllow' | 'thetaAllow' | 'rpm';

export interface TorsionState {
  shaft: Shaft;
  title: string;
  preset: TorsionPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  shaft: Shaft;
  title: string;
  preset: TorsionState['preset'];
}

export function parseShaft(raw: unknown): { ok: true; shaft: Shaft } | { ok: false; errors: string[] } {
  if (!isObj(raw)) return { ok: false, errors: ['В файле нет вала (shaft).'] };
  const errors: string[] = [];
  const steps: ShaftStep[] = [];
  if (!Array.isArray(raw.steps) || !raw.steps.length || raw.steps.length > MAX_STEPS) errors.push(`Участков должно быть от 1 до ${MAX_STEPS}.`);
  else
    raw.steps.forEach((s: unknown, i: number) => {
      if (!isObj(s) || !isNum(s.l) || s.l <= 0 || !isNum(s.k) || s.k <= 0 || !isNum(s.c) || s.c < 0 || s.c >= 1) errors.push(`Участок №${i + 1}: длина и доля диаметра — положительные, c — от 0 до 1.`);
      else steps.push({ l: s.l, k: s.k, c: s.c });
    });
  const arr = (k: string) => (Array.isArray(raw[k]) ? (raw[k] as unknown[]) : []);
  const moments = arr('moments'),
    powers = arr('powers');
  if (moments.length !== steps.length + 1 || !moments.every(isNum)) errors.push('Моментов должно быть по одному на каждую точку вала, каждый — число.');
  if (powers.length && (powers.length !== steps.length + 1 || !powers.every(isNum))) errors.push('Мощностей должно быть по одной на каждую точку вала.');
  if (!['none', 'left', 'right', 'both'].includes(raw.supports as string)) errors.push('Закрепление: none, left, right или both.');
  if (!['find', 'given'].includes(raw.dMode as string)) errors.push('Диаметр: find или given.');
  for (const k of ['G', 'd', 'tauAllow', 'thetaAllow', 'rpm']) if (!isNum(raw[k]) || (raw[k] as number) < 0) errors.push(`${k} — неотрицательное число.`);
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    shaft: {
      steps,
      moments: moments as number[],
      load: raw.load === 'power' ? 'power' : 'moment',
      powers: powers.length ? (powers as number[]) : steps.map(() => 0).concat(0),
      rpm: raw.rpm as number,
      supports: raw.supports as Shaft['supports'],
      dMode: raw.dMode as Shaft['dMode'],
      G: raw.G as number,
      d: raw.d as number,
      tauAllow: raw.tauAllow as number,
      thetaAllow: raw.thetaAllow as number,
    },
  };
}

export class TorsionStore {
  private st: TorsionState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: TorsionPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'pulleys';
    this.st = { shaft: structuredClone(TORSION_PRESETS[k].shaft), title: TORSION_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): TorsionState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<TorsionState>) {
    this.st = { ...this.st, ...patch, canUndo: this.hist.canUndo, canRedo: this.hist.canRedo };
    this.listeners.forEach((f) => f());
  }
  private snap = (): Snap => ({ shaft: this.st.shaft, title: this.st.title, preset: this.st.preset });
  private commit() {
    this.hist.push(this.snap());
    if (this.st.preset !== 'custom') this.st = { ...this.st, preset: 'custom', title: 'Свой вал' };
  }
  private touch(key: string) {
    if (this.hist.startSession(key)) this.commit();
  }
  endSession = (key: string) => this.hist.endSession(key);
  private setShaft(shaft: Shaft) {
    this.set({ shaft });
  }
  loadPreset = (k: TorsionPresetKey) => {
    this.commit();
    this.set({ shaft: structuredClone(TORSION_PRESETS[k].shaft), title: TORSION_PRESETS[k].title, preset: k });
  };
  typeStep = (i: number, key: keyof ShaftStep, v: number) => {
    this.touch(`step:${i}:${key}`);
    this.setShaft({ ...this.st.shaft, steps: this.st.shaft.steps.map((s, j) => (j === i ? { ...s, [key]: v } : s)) });
  };
  typeLoad = (j: number, v: number) => {
    const key = this.st.shaft.load === 'power' ? 'powers' : 'moments';
    this.touch(`${key}:${j}`);
    this.setShaft({ ...this.st.shaft, [key]: this.st.shaft[key].map((x, k) => (k === j ? v : x)) });
  };
  typeField = (key: TorsionNumKey, v: number) => {
    this.touch(key);
    this.setShaft({ ...this.st.shaft, [key]: v });
  };
  setField = <K extends 'supports' | 'dMode' | 'load'>(key: K, v: Shaft[K]) => {
    if (this.st.shaft[key] === v) return;
    this.commit();
    const s = { ...this.st.shaft, [key]: v };
    if (key === 'load' && s.powers.length !== s.steps.length + 1) s.powers = s.steps.map(() => 0).concat(0);
    if (key === 'load' && v === 'power' && !(s.rpm > 0)) s.rpm = 500;
    this.setShaft(s);
  };
  addStep = () => {
    const s = this.st.shaft;
    if (s.steps.length >= MAX_STEPS) return;
    this.commit();
    this.setShaft({ ...s, steps: [...s.steps, { ...s.steps[s.steps.length - 1] }], moments: [...s.moments, 0], powers: [...s.powers, 0] });
  };
  removeStep = (i: number) => {
    const s = this.st.shaft;
    if (s.steps.length <= 1) return;
    this.commit();
    this.setShaft({ ...s, steps: s.steps.filter((_, j) => j !== i), moments: s.moments.filter((_, j) => j !== i + 1), powers: s.powers.filter((_, j) => j !== i + 1) });
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
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(TORSION_MODULE, this.st.title, { shaft: this.st.shaft }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== TORSION_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseShaft(env.raw.shaft);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Кручение вала';
    this.set({ shaft: r.shaft, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
