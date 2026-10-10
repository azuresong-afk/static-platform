/** Состояние вкладки «Принцип Даламбера»: тело на оси, опоры, ω и ε; история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { PartKind } from '../../inertia/model/inertia';
import { newPart, parseInertia } from '../../inertia/ui/store';
import type { ShaftProblem } from '../model/shaft';
import { SHAFT_PRESETS, type ShaftPresetKey } from '../presets';

export const DALEMBERT_MODULE = 'dalembert';
const MAX_PARTS = 12;
export const TOP_KEYS = ['zA', 'zB', 'omega', 'eps'] as const;
export type TopKey = (typeof TOP_KEYS)[number];
export const DRIVE_KEYS = ['M', 't', 'omega0'] as const;
export type DriveKey = (typeof DRIVE_KEYS)[number];

export interface ShaftState {
  problem: ShaftProblem;
  title: string;
  preset: ShaftPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: ShaftProblem;
  title: string;
  preset: ShaftState['preset'];
}
const copy = (p: ShaftProblem): ShaftProblem => structuredClone(p);

export function parseShaft(raw: unknown): { ok: true; problem: ShaftProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !Array.isArray(raw.parts) || !TOP_KEYS.every((k) => isNum(raw[k])) || !['z', 'y', 'none'].includes(raw.gravity as string)) return { ok: false, errors: ['В файле нет задачи (problem с полями parts, zA, zB, gravity, omega, eps).'] };
  const p = parseInertia({ parts: raw.parts, A: [0, 0, 0], axis: [0, 0, 1], byWeight: raw.byWeight });
  if (!p.ok) return p;
  const d = raw.drive;
  if (d != null && !(isObj(d) && DRIVE_KEYS.every((k) => isNum(d[k])) && (d.t as number) >= 0)) return { ok: false, errors: ['Вращение под действием пары: числа M, t ≥ 0 и omega0.'] };
  return {
    ok: true,
    problem: {
      parts: p.problem.parts,
      byWeight: raw.byWeight === true,
      gravity: raw.gravity as ShaftProblem['gravity'],
      zA: raw.zA as number,
      zB: raw.zB as number,
      omega: raw.omega as number,
      eps: raw.eps as number,
      ...(isObj(d) ? { drive: { M: d.M as number, t: d.t as number, omega0: d.omega0 as number } } : {}),
    },
  };
}

export class ShaftStore {
  private st: ShaftState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: ShaftPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm427';
    this.st = { problem: copy(SHAFT_PRESETS[k].problem as ShaftProblem), title: SHAFT_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): ShaftState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<ShaftState>) {
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
  private edit(fn: (p: ShaftProblem) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  loadPreset = (k: ShaftPresetKey) => {
    this.commit();
    this.set({ problem: copy(SHAFT_PRESETS[k].problem as ShaftProblem), title: SHAFT_PRESETS[k].title, preset: k });
  };
  addPart = () => {
    if (this.st.problem.parts.length >= MAX_PARTS) return;
    this.commit();
    this.edit((p) => p.parts.push({ ...newPart('point'), c: [0.3, 0, 0] }));
  };
  removePart = (i: number) => {
    if (this.st.problem.parts.length <= 1) return;
    this.commit();
    this.edit((p) => p.parts.splice(i, 1));
  };
  setKind = (i: number, kind: PartKind) => {
    this.commit();
    this.edit((p) => (p.parts[i] = { ...newPart(kind), m: p.parts[i].m, c: p.parts[i].c, u: p.parts[i].u, s: p.parts[i].s }));
  };
  setSign = (i: number, cut: boolean) => {
    this.commit();
    this.edit((p) => (p.parts[i].s = cut ? -1 : 1));
  };
  typePart = (i: number, key: string, v: number) => {
    this.touch(`p:${i}:${key}`);
    this.edit((p) => {
      const q = p.parts[i];
      if (key === 'm') q.m = v;
      else if (/^[cu][012]$/.test(key)) q[key[0] as 'c' | 'u'][+key[1]] = v;
      else q.p[key] = v;
    });
  };
  setByWeight = (on: boolean) => {
    this.commit();
    this.edit((p) => (p.byWeight = on));
  };
  setGravity = (g: ShaftProblem['gravity']) => {
    this.commit();
    this.edit((p) => (p.gravity = g));
  };
  typeTop = (key: TopKey, v: number) => {
    this.touch(`t:${key}`);
    this.edit((p) => (p[key] = v));
  };
  /** Вращение: ω и ε заданы или тело вращается под действием пары (ε и ω находятся). */
  setDriven = (on: boolean) => {
    if (on === !!this.st.problem.drive) return;
    this.commit();
    this.edit((p) => {
      if (on) p.drive = { M: 1, t: 1, omega0: 0 };
      else delete p.drive;
    });
  };
  typeDrive = (key: DriveKey, v: number) => {
    if (!this.st.problem.drive) return;
    this.touch(`d:${key}`);
    this.edit((p) => (p.drive![key] = v));
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
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(DALEMBERT_MODULE, this.st.title, { problem: this.st.problem }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== DALEMBERT_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseShaft(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Принцип Даламбера';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
