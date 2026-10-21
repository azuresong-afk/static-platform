/** Состояние вкладки «Переменная масса»: прямолинейное движение и ступени ракеты; история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { Particles, Stage, StagesProblem, StopKind, VarLine } from '../model/varmass';
import { VAR_PRESETS, line, type VarMode, type VarPresetKey, type VarState } from '../presets';
import { extraProblem, findAsk, parseExtra, type ExtraProblem } from '../../../shared/extra';
import { VARMASS_ASKS } from '../model/extra';
import { VARMASS_EXTRA_PRESETS, type VarExtraKey } from '../extraPresets';

export const VARMASS_MODULE = 'varmass';
export const LINE_NUM = ['g', 'alpha', 'Rg', 'w', 'm0', 've', 'beta', 'f', 'k1', 'k2', 'x0', 'v0', 't1', 'm1', 'v1', 's1'] as const;
export type LineNumKey = (typeof LINE_NUM)[number];
export const STAGE_NUM = ['ve', 'z', 's', 'vt'] as const;
export type StageNumKey = (typeof STAGE_NUM)[number];
const MAXST = 6;
const STOPS: StopKind[] = ['time', 'mass', 'speed', 'dist', 'rest'];
const PARTS: Particles[] = ['jet', 'zeroAbs', 'zeroRel'];

export interface VmState {
  problem: VarState;
  /** Задачи пункта 24 (общий вид, обратные задачи, ротор, центр переменной массы) и какой экран показан. */
  extra: ExtraProblem;
  view: 'main' | 'extra';
  title: string;
  preset: VarPresetKey | VarExtraKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: VarState;
  extra: ExtraProblem;
  view: 'main' | 'extra';
  title: string;
  preset: VmState['preset'];
}
const copy = <T>(p: T): T => structuredClone(p);
const DEF: VarState = { mode: 'line', line: line({}), stages: { ask: 'speeds', stages: [{ ve: 2500, z: 4, s: 5, vt: 3000 }], q: 100, v: 6000 } };

export function presetState(k: VarPresetKey, base: VarState = DEF): VarState {
  const t = VAR_PRESETS[k].problem;
  const s = copy(base);
  s.mode = t.mode;
  if (t.mode === 'line') s.line = copy(t.line);
  else s.stages = copy(t.stages);
  return s;
}

function parseLine(raw: unknown): VarLine | null {
  if (!isObj(raw) || !LINE_NUM.every((k) => isNum(raw[k])) || typeof raw.mLaw !== 'string' || typeof raw.force !== 'string') return null;
  if (
    !['uniform', 'inverse', 'none'].includes(raw.grav as string) ||
    !['law', 'accel'].includes(raw.massMode as string) ||
    !PARTS.includes(raw.part as Particles) ||
    !STOPS.includes(raw.stop as StopKind)
  )
    return null;
  const nums = Object.fromEntries(LINE_NUM.map((k) => [k, raw[k]])) as Record<LineNumKey, number>;
  return {
    ...nums,
    grav: raw.grav as VarLine['grav'],
    massMode: raw.massMode as VarLine['massMode'],
    part: raw.part as Particles,
    stop: raw.stop as StopKind,
    mLaw: raw.mLaw.slice(0, 200),
    force: raw.force.slice(0, 200),
    coast: raw.coast === true,
  };
}
function parseStagesP(raw: unknown): StagesProblem | null {
  if (!isObj(raw) || !['speeds', 'z', 'weights', 'optimal'].includes(raw.ask as string) || !isNum(raw.q) || !isNum(raw.v) || !Array.isArray(raw.stages))
    return null;
  const stages: Stage[] = [];
  for (const st of raw.stages) {
    if (!isObj(st) || !STAGE_NUM.every((k) => isNum(st[k]))) return null;
    stages.push({ ve: st.ve as number, z: st.z as number, s: st.s as number, vt: st.vt as number });
  }
  if (!stages.length || stages.length > MAXST) return null;
  return { ask: raw.ask as StagesProblem['ask'], q: raw.q, v: raw.v, stages };
}

export function parseVar(raw: unknown): { ok: true; problem: VarState } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !['line', 'stages'].includes(raw.mode as string)) return { ok: false, errors: ['В файле нет задачи (problem с полем mode).'] };
  const l = parseLine(raw.line),
    s = parseStagesP(raw.stages);
  if (!(raw.mode === 'line' ? l : s)) return { ok: false, errors: ['Данные задачи неполные.'] };
  return { ok: true, problem: { mode: raw.mode as VarMode, line: l ?? copy(DEF.line), stages: s ?? copy(DEF.stages) } };
}

export class VmStore {
  private st: VmState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: VarPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm453';
    this.st = { problem: presetState(k), extra: structuredClone(VARMASS_EXTRA_PRESETS.x452.problem), view: 'main', title: VAR_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): VmState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<VmState>) {
    this.st = { ...this.st, ...patch, canUndo: this.hist.canUndo, canRedo: this.hist.canRedo };
    this.listeners.forEach((f) => f());
  }
  private snap = (): Snap => ({ problem: this.st.problem, extra: this.st.extra, view: this.st.view, title: this.st.title, preset: this.st.preset });
  private commit() {
    this.hist.push(this.snap());
    if (this.st.preset !== 'custom') this.st = { ...this.st, preset: 'custom', title: 'Своя задача' };
  }
  private touch(key: string) {
    if (this.hist.startSession(key)) this.commit();
  }
  endSession = (key: string) => this.hist.endSession(key);
  private edit(fn: (p: VarState) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  loadPreset = (k: VarPresetKey | VarExtraKey) => {
    this.commit();
    if (k in VARMASS_EXTRA_PRESETS) {
      const e = VARMASS_EXTRA_PRESETS[k as VarExtraKey];
      return this.set({ extra: structuredClone(e.problem), view: 'extra', title: e.title, preset: k });
    }
    this.set({ problem: presetState(k as VarPresetKey, this.st.problem), view: 'main', title: VAR_PRESETS[k as VarPresetKey].title, preset: k });
  };
  /* задачи пункта 24 */
  setView = (view: 'main' | 'extra') => {
    if (view !== this.st.view) this.set({ view });
  };
  private editX(fn: (x: ExtraProblem) => void) {
    const x = structuredClone(this.st.extra);
    fn(x);
    this.set({ extra: x });
  }
  setXAsk = (id: string) => {
    this.commit();
    this.set({ extra: extraProblem(findAsk(VARMASS_ASKS, id)) });
  };
  typeNum = (k: string, v: number) => {
    this.touch(`x:${k}`);
    this.editX((x) => (x.n[k] = v));
  };
  typeText = (k: string, s: string) => {
    this.touch(`x:${k}`);
    this.editX((x) => (x.s[k] = s.slice(0, 300)));
  };
  pick = (k: string, v: string) => {
    this.commit();
    this.editX((x) => (x.s[k] = v));
  };
  setMode = (m: VarMode) => {
    if (m === this.st.problem.mode) return;
    this.commit();
    this.edit((p) => (p.mode = m));
  };
  /* прямолинейное движение */
  typeLine = (key: LineNumKey, v: number) => {
    this.touch(`l:${key}`);
    this.edit((p) => (p.line[key] = v));
  };
  typeLaw = (key: 'mLaw' | 'force', s: string) => {
    this.touch(`l:${key}`);
    this.edit((p) => (p.line[key] = s.slice(0, 200)));
  };
  setLine = <K extends 'grav' | 'massMode' | 'part' | 'stop'>(key: K, v: VarLine[K]) => {
    this.commit();
    this.edit((p) => (p.line[key] = v));
  };
  setCoast = (on: boolean) => {
    this.commit();
    this.edit((p) => (p.line.coast = on));
  };
  /* ступени */
  setAsk = (a: StagesProblem['ask']) => {
    this.commit();
    this.edit((p) => (p.stages.ask = a));
  };
  typeStagesTop = (key: 'q' | 'v', v: number) => {
    this.touch(`s:${key}`);
    this.edit((p) => (p.stages[key] = v));
  };
  typeStage = (i: number, key: StageNumKey, v: number) => {
    this.touch(`st:${i}:${key}`);
    this.edit((p) => (p.stages.stages[i][key] = v));
  };
  addStage = () => {
    if (this.st.problem.stages.stages.length >= MAXST) return;
    this.commit();
    this.edit((p) => {
      const last = p.stages.stages[p.stages.stages.length - 1];
      p.stages.stages.push({ ...last, vt: last.vt + 2000 });
    });
  };
  removeStage = (i: number) => {
    if (this.st.problem.stages.stages.length <= 1) return;
    this.commit();
    this.edit((p) => p.stages.stages.splice(i, 1));
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
    text: writeEnvelope(VARMASS_MODULE, this.st.title, { problem: this.st.problem, extra: this.st.extra, view: this.st.view }, now),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== VARMASS_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseVar(env.raw.problem);
    const ex = parseExtra(env.raw.extra, VARMASS_ASKS);
    const view = env.raw.view === 'extra' && ex ? 'extra' : 'main';
    if (!r.ok && !(view === 'extra' && ex)) return (this.notify(head + (r.ok ? '' : r.errors.slice(0, 4).join(' ')), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Переменная масса';
    this.set({ problem: r.ok ? r.problem : this.st.problem, extra: ex ?? this.st.extra, view, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
