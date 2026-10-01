/** Состояние вкладки «Вращение тела и передачи»: закон ведущего звена, цепочка колёс, искомое; история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import { LINKS, type GearProblem, type Link, type Wheel } from '../model/gears';
import { GEAR_PRESETS, type GearPresetKey } from '../presets';

export const GEAR_MODULE = 'gears';
const NUM = ['rho', 't', 'target', 'tMax'] as const;
export type GearNumKey = (typeof NUM)[number];
export const MAX_WHEELS = 8;
const LINK_IDS = LINKS.map((l) => l[0]) as string[];

export interface GearState {
  problem: GearProblem;
  title: string;
  preset: GearPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: GearProblem;
  title: string;
  preset: GearState['preset'];
}
const copy = (p: GearProblem): GearProblem => structuredClone(p);

export function parseGears(raw: unknown): { ok: true; problem: GearProblem } | { ok: false; errors: string[] } {
  const bad = { ok: false as const, errors: ['В файле нет задачи (problem с полями drive, law, wheels, k, rho, t, find, target, unit, tMax).'] };
  if (!isObj(raw) || !['phi', 'x'].includes(raw.drive as string) || typeof raw.law !== 'string' || !Array.isArray(raw.wheels) || !NUM.every((k) => isNum(raw[k])) || !isNum(raw.k) || typeof raw.find !== 'boolean' || !['rad', 'rpm'].includes(raw.unit as string)) return bad;
  const ws = raw.wheels as unknown[];
  if (!ws.length || ws.length > MAX_WHEELS || !ws.every((w) => isObj(w) && isNum(w.r) && isNum(w.z) && LINK_IDS.includes(w.link as string))) return { ok: false, errors: [`Колёса: от 1 до ${MAX_WHEELS}, у каждого r, z и link.`] };
  const wheels = ws.map((w) => ({ r: (w as Wheel).r, z: (w as Wheel).z, link: (w as Wheel).link }));
  const n = Object.fromEntries(NUM.map((k) => [k, raw[k]])) as Record<GearNumKey, number>;
  return { ok: true, problem: { drive: raw.drive as 'phi' | 'x', law: raw.law.slice(0, 200), wheels, k: Math.min(Math.max(0, Math.round(raw.k as number)), wheels.length - 1), find: raw.find, unit: raw.unit as 'rad' | 'rpm', ...n } };
}

export class GearStore {
  private st: GearState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: GearPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'g145';
    this.st = { problem: copy(GEAR_PRESETS[k].problem as GearProblem), title: GEAR_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): GearState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<GearState>) {
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
  private edit(fn: (p: GearProblem) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  private change(fn: (p: GearProblem) => void) {
    this.commit();
    this.edit(fn);
  }
  loadPreset = (k: GearPresetKey) => {
    this.commit();
    this.set({ problem: copy(GEAR_PRESETS[k].problem as GearProblem), title: GEAR_PRESETS[k].title, preset: k });
  };
  setDrive = (d: 'phi' | 'x') => d !== this.st.problem.drive && this.change((p) => (p.drive = d));
  typeLaw = (s: string) => {
    this.touch('law');
    this.edit((p) => (p.law = s.slice(0, 200)));
  };
  typeNum = (k: GearNumKey, v: number) => {
    this.touch(`n:${k}`);
    this.edit((p) => (p[k] = v));
  };
  setK = (k: number) => k !== this.st.problem.k && this.change((p) => (p.k = k));
  setFind = (on: boolean) => this.change((p) => (p.find = on));
  setUnit = (u: 'rad' | 'rpm') => u !== this.st.problem.unit && this.change((p) => (p.unit = u));
  typeWheel = (j: number, key: 'r' | 'z', v: number) => {
    this.touch(`w:${j}:${key}`);
    this.edit((p) => (p.wheels[j][key] = v));
  };
  setLink = (j: number, l: Link) => this.change((p) => (p.wheels[j].link = l));
  addWheel = () => {
    if (this.st.problem.wheels.length >= MAX_WHEELS) return;
    this.change((p) => {
      const last = p.wheels[p.wheels.length - 1];
      p.wheels.push({ r: last.r, z: last.z, link: 'ext' });
    });
  };
  removeWheel = (j: number) => {
    if (this.st.problem.wheels.length <= 1) return;
    this.change((p) => {
      p.wheels.splice(j, 1);
      p.k = Math.min(p.k, p.wheels.length - 1);
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
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(GEAR_MODULE, this.st.title, { problem: this.st.problem }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== GEAR_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseGears(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Вращение тела и передачи';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
