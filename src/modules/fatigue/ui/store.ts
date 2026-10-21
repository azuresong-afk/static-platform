/** Состояние вкладки «Усталостная прочность»: материал, циклы, коэффициенты детали; история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { Cycle, FatigueProblem } from '../model/fatigue';
import { FATIGUE_PRESETS, type FatiguePresetKey } from '../presets';

export const FATIGUE_MODULE = 'fatigue';
export const FAT_NUM = ['sigB', 'sigT', 'sig1', 'tau1', 'tauB', 'Ks', 'Kt', 'KF', 'Kd', 'beta', 'Kv', 'nAllow'] as const;
export type FatNumKey = (typeof FAT_NUM)[number];
export type CycleKey = 'sigma' | 'tau';
export type CycleNum = 'max' | 'min' | 'm' | 'a';

export interface FatigueState {
  problem: FatigueProblem;
  title: string;
  preset: FatiguePresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: FatigueProblem;
  title: string;
  preset: FatigueState['preset'];
}
const copy = (p: FatigueProblem): FatigueProblem => structuredClone(p);

function parseCycle(raw: unknown): Cycle | null {
  if (!isObj(raw) || !['max', 'min', 'm', 'a'].every((k) => isNum(raw[k])) || !['minmax', 'ma'].includes(raw.mode as string)) return null;
  return { on: raw.on === true, mode: raw.mode as Cycle['mode'], max: raw.max as number, min: raw.min as number, m: raw.m as number, a: raw.a as number };
}

export function parseFatigue(raw: unknown): { ok: true; problem: FatigueProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !FAT_NUM.every((k) => isNum(raw[k])) || !['mult', 'surf'].includes(raw.kMode as string))
    return { ok: false, errors: ['В файле нет задачи (problem с характеристиками материала и коэффициентами).'] };
  const sigma = parseCycle(raw.sigma),
    tau = parseCycle(raw.tau);
  if (!sigma || !tau) return { ok: false, errors: ['Данные циклов напряжений неполные.'] };
  const n = Object.fromEntries(FAT_NUM.map((k) => [k, raw[k]])) as Record<FatNumKey, number>;
  return { ok: true, problem: { ...n, kMode: raw.kMode as FatigueProblem['kMode'], sigma, tau } };
}

export class FatigueStore {
  private st: FatigueState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: FatiguePresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'f117';
    this.st = {
      problem: copy(FATIGUE_PRESETS[k].problem),
      title: FATIGUE_PRESETS[k].title,
      preset: k,
      canUndo: false,
      canRedo: false,
      notice: null,
      explain: opts.explain ?? true,
    };
  }
  get = (): FatigueState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<FatigueState>) {
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
  private edit(fn: (p: FatigueProblem) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  loadPreset = (k: FatiguePresetKey) => {
    this.commit();
    this.set({ problem: copy(FATIGUE_PRESETS[k].problem), title: FATIGUE_PRESETS[k].title, preset: k });
  };
  typeNum = (k: FatNumKey, v: number) => {
    this.touch(`n:${k}`);
    this.edit((p) => (p[k] = v));
  };
  typeCycle = (c: CycleKey, k: CycleNum, v: number) => {
    this.touch(`${c}:${k}`);
    this.edit((p) => (p[c][k] = v));
  };
  /** Включить или выключить цикл; при переключении способа задания пересчитать вторую пару величин. */
  setCycle = (c: CycleKey, patch: Partial<Pick<Cycle, 'on' | 'mode'>>) => {
    this.commit();
    this.edit((p) => {
      const cy = p[c];
      if (patch.mode && patch.mode !== cy.mode) {
        if (patch.mode === 'ma') {
          cy.m = (cy.max + cy.min) / 2;
          cy.a = Math.abs(cy.max - cy.min) / 2;
        } else {
          cy.max = cy.m + Math.abs(cy.a);
          cy.min = cy.m - Math.abs(cy.a);
        }
      }
      Object.assign(cy, patch);
    });
  };
  setKMode = (m: FatigueProblem['kMode']) => {
    if (m === this.st.problem.kMode) return;
    this.commit();
    this.edit((p) => (p.kMode = m));
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
    text: writeEnvelope(FATIGUE_MODULE, this.st.title, { problem: this.st.problem }, now),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== FATIGUE_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseFatigue(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Усталостная прочность';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
