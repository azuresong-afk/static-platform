/** Состояние вкладки «Растяжение-сжатие»: брус, история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { Bar, Step } from '../model/bar';
import { AXIAL_PRESETS, type AxialPresetKey } from '../presets';

export const AXIAL_MODULE = 'axial';
const MAX_STEPS = 10;

export interface AxialState {
  bar: Bar;
  title: string;
  preset: AxialPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}

interface Snap {
  bar: Bar;
  title: string;
  preset: AxialState['preset'];
}

/** Проверка бруса из файла. */
export function parseBar(raw: unknown): { ok: true; bar: Bar } | { ok: false; errors: string[] } {
  if (!isObj(raw)) return { ok: false, errors: ['В файле нет бруса (bar).'] };
  const errors: string[] = [];
  const steps: Step[] = [];
  if (!Array.isArray(raw.steps) || !raw.steps.length || raw.steps.length > MAX_STEPS) errors.push(`Ступеней должно быть от 1 до ${MAX_STEPS}.`);
  else
    raw.steps.forEach((s: unknown, i: number) => {
      if (!isObj(s) || !isNum(s.l) || s.l <= 0 || !isNum(s.c) || s.c <= 0 || !isNum(s.dT)) errors.push(`Ступень №${i + 1}: длина и доля площади — положительные числа, нагрев — число.`);
      else steps.push({ l: s.l, c: s.c, dT: s.dT });
    });
  const forces = Array.isArray(raw.forces) ? raw.forces : [];
  if (forces.length !== steps.length + 1 || !forces.every(isNum)) errors.push('Сил должно быть по одной на каждую точку бруса (ступеней + 1), каждая — число.');
  if (!['left', 'right', 'both'].includes(raw.supports as string)) errors.push('Закрепление: ожидается left, right или both.');
  if (!['find', 'given'].includes(raw.areaMode as string)) errors.push('Площадь: ожидается find или given.');
  const pos = (k: string, label: string, zero = false) => {
    const x = raw[k];
    if (!isNum(x) || x < 0 || (!zero && x === 0)) errors.push(`${label} должно быть ${zero ? 'неотрицательным' : 'положительным'} числом.`);
  };
  pos('E', 'E');
  pos('alpha', 'α', true);
  pos('A', 'A');
  pos('sigmaAllow', '[σ]');
  pos('sigmaT', 'σт', true);
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    bar: {
      steps,
      forces: forces as number[],
      supports: raw.supports as Bar['supports'],
      areaMode: raw.areaMode as Bar['areaMode'],
      E: raw.E as number,
      alpha: raw.alpha as number,
      A: raw.A as number,
      sigmaAllow: raw.sigmaAllow as number,
      sigmaT: raw.sigmaT as number,
    },
  };
}

export class AxialStore {
  private st: AxialState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();

  constructor(opts: { preset?: AxialPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'antonov11';
    this.st = { bar: AXIAL_PRESETS[k].bar, title: AXIAL_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }

  get = (): AxialState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<AxialState>) {
    this.st = { ...this.st, ...patch, canUndo: this.hist.canUndo, canRedo: this.hist.canRedo };
    this.listeners.forEach((f) => f());
  }
  private snap = (): Snap => ({ bar: this.st.bar, title: this.st.title, preset: this.st.preset });
  /** Запись истории перед изменением; задача становится «своей». */
  private commit() {
    this.hist.push(this.snap());
    if (this.st.preset !== 'custom') this.st = { ...this.st, preset: 'custom', title: 'Свой брус' };
  }
  private touch(key: string) {
    if (this.hist.startSession(key)) this.commit();
  }
  endSession = (key: string) => this.hist.endSession(key);
  private setBar(bar: Bar) {
    this.set({ bar });
  }

  loadPreset = (k: AxialPresetKey) => {
    this.commit();
    this.set({ bar: AXIAL_PRESETS[k].bar, title: AXIAL_PRESETS[k].title, preset: k });
  };
  /** Поле ступени (длина, доля площади, нагрев). */
  typeStep = (i: number, key: keyof Step, v: number) => {
    this.touch(`step:${i}:${key}`);
    this.setBar({ ...this.st.bar, steps: this.st.bar.steps.map((s, j) => (j === i ? { ...s, [key]: v } : s)) });
  };
  typeForce = (j: number, v: number) => {
    this.touch(`force:${j}`);
    this.setBar({ ...this.st.bar, forces: this.st.bar.forces.map((f, k) => (k === j ? v : f)) });
  };
  typeField = (key: 'E' | 'alpha' | 'A' | 'sigmaAllow' | 'sigmaT', v: number) => {
    this.touch(key);
    this.setBar({ ...this.st.bar, [key]: v });
  };
  setField = <K extends 'supports' | 'areaMode'>(key: K, v: Bar[K]) => {
    if (this.st.bar[key] === v) return;
    this.commit();
    this.setBar({ ...this.st.bar, [key]: v });
  };
  /** Новая ступень справа (копия последней), с точкой без силы. */
  addStep = () => {
    const b = this.st.bar;
    if (b.steps.length >= MAX_STEPS) return;
    this.commit();
    this.setBar({ ...b, steps: [...b.steps, { ...b.steps[b.steps.length - 1], dT: 0 }], forces: [...b.forces, 0] });
  };
  /** Убрать ступень i вместе с точкой её правого конца (сила там пропадает). */
  removeStep = (i: number) => {
    const b = this.st.bar;
    if (b.steps.length <= 1) return;
    this.commit();
    this.setBar({ ...b, steps: b.steps.filter((_, j) => j !== i), forces: b.forces.filter((_, j) => j !== i + 1) });
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
    text: writeEnvelope(AXIAL_MODULE, this.st.title, { bar: this.st.bar }, now),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) {
      this.notify(head + env.errors.join(' '), 'bad');
      return false;
    }
    if (env.module !== AXIAL_MODULE) {
      this.notify(head + 'это файл другого раздела.', 'bad');
      return false;
    }
    const r = parseBar(env.raw.bar);
    if (!r.ok) {
      this.notify(head + r.errors.slice(0, 4).join(' '), 'bad');
      return false;
    }
    this.commit();
    const title = env.title ?? 'Брус';
    this.set({ bar: r.bar, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
