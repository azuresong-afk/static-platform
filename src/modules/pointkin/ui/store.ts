/**
 * Состояние вкладки «Кинематика точки»: способ задания, формулы, момент t; равнопеременное движение
 * (три величины из пяти); история отмены, файл проекта.
 */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { KinMode, KinProblem } from '../model/kin';
import { MODE_P } from '../model/modes';
import { DEF_UNI, LIN_KEYS, type LinKey, type LinUni } from '../model/uniform';
import { KIN_PRESETS, type KinPresetKey } from '../presets';

export const KIN_MODULE = 'pointkin';
const STR = ['x', 'y', 'z', 's', 'r', 'phi'] as const;
export type KinStrKey = (typeof STR)[number] | 'th';
const MODES: KinMode[] = ['coord', 'natural', 'polar', 'cyl', 'sph', 'tor', 'uni', 'path', 'integ', 'harm', 'shot', 'cam'];
export type LinNumKey = LinKey | 'rho' | 'tq';
const NUM = ['rho', 't', 't1', 't2'] as const;
export type KinNumKey = (typeof NUM)[number];

export interface KinState {
  problem: KinProblem;
  title: string;
  preset: KinPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: KinProblem;
  title: string;
  preset: KinState['preset'];
}
const copy = (p: KinProblem): KinProblem => structuredClone(p);

function parseUni(raw: unknown): LinUni | null {
  if (!isObj(raw) || ![...LIN_KEYS, 'rho', 'tq'].every((k) => isNum(raw[k])) || !Array.isArray(raw.known)) return null;
  const known = (raw.known as unknown[]).filter((k): k is LinKey => LIN_KEYS.includes(k as LinKey));
  const n = Object.fromEntries([...LIN_KEYS, 'rho', 'tq'].map((k) => [k, raw[k]])) as Record<LinNumKey, number>;
  return { ...n, known: [...new Set(known)], kmh: raw.kmh === true };
}

export function parseKin(raw: unknown): { ok: true; problem: KinProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !MODES.includes(raw.mode as KinMode) || !STR.every((k) => typeof raw[k] === 'string') || !NUM.every((k) => isNum(raw[k]))) return { ok: false, errors: ['В файле нет задачи (problem с полями mode, x, y, z, s, r, phi, rho, t).'] };
  const s = Object.fromEntries(STR.map((k) => [k, (raw[k] as string).slice(0, 200)])) as Record<(typeof STR)[number], string>;
  const n = Object.fromEntries(NUM.map((k) => [k, raw[k]])) as Record<KinNumKey, number>;
  // Файлы до сферических координат и равнопеременного движения — без полей th и uni.
  const uni = raw.uni == null ? structuredClone(DEF_UNI) : parseUni(raw.uni);
  if (!uni) return { ok: false, errors: ['Данные равнопеременного движения неполные.'] };
  const p = isObj(raw.p) ? Object.fromEntries(Object.entries(raw.p).filter(([, x]) => typeof x === 'string').map(([k, x]) => [k.slice(0, 20), (x as string).slice(0, 200)])) : undefined;
  return { ok: true, problem: { mode: raw.mode as KinMode, ...s, ...n, th: typeof raw.th === 'string' ? raw.th.slice(0, 200) : '', uni, ...(p ? { p } : {}) } };
}

export class KinStore {
  private st: KinState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: KinPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'k1228';
    this.st = { problem: copy(KIN_PRESETS[k].problem as KinProblem), title: KIN_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): KinState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<KinState>) {
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
  private edit(fn: (p: KinProblem) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  loadPreset = (k: KinPresetKey) => {
    this.commit();
    this.set({ problem: copy(KIN_PRESETS[k].problem as KinProblem), title: KIN_PRESETS[k].title, preset: k });
  };
  setMode = (m: KinMode) => {
    if (m === this.st.problem.mode) return;
    this.commit();
    this.edit((p) => {
      p.mode = m;
      if (MODE_P[m]) p.p = { ...MODE_P[m], ...(p.p ?? {}) };
    });
  };
  /** Параметр режима (p): формула, число или выбор из списка. */
  typeP = (k: string, s: string) => {
    this.touch(`p:${k}`);
    this.edit((pr) => (pr.p = { ...(pr.p ?? {}), [k]: s.slice(0, 200) }));
  };
  setP = (k: string, s: string) => {
    this.commit();
    this.edit((pr) => (pr.p = { ...(pr.p ?? {}), [k]: s }));
  };
  typeStr = (k: KinStrKey, s: string) => {
    this.touch(`s:${k}`);
    this.edit((p) => (p[k] = s.slice(0, 200)));
  };
  typeNum = (k: KinNumKey, v: number) => {
    this.touch(`n:${k}`);
    this.edit((p) => (p[k] = v));
  };
  /* равнопеременное движение */
  private uniEdit(fn: (u: LinUni) => void) {
    this.edit((p) => {
      p.uni ??= structuredClone(DEF_UNI);
      fn(p.uni);
    });
  }
  typeUni = (k: LinNumKey, v: number) => {
    this.touch(`u:${k}`);
    this.uniEdit((u) => (u[k] = v));
  };
  toggleKnown = (k: LinKey) => {
    this.commit();
    this.uniEdit((u) => (u.known = u.known.includes(k) ? u.known.filter((x) => x !== k) : [...u.known, k]));
  };
  setKmh = (on: boolean) => {
    this.commit();
    this.uniEdit((u) => (u.kmh = on));
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
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(KIN_MODULE, this.st.title, { problem: this.st.problem }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== KIN_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseKin(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Кинематика точки';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
