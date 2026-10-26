/** Состояние вкладки «Центроиды»: готовая задача, размеры, текущее φ, история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import { sourceRange } from '../model/centrodes';
import { OWN_DEFAULT, ownSource, type OwnMotion } from '../model/own';
import { CENTRODE_PRESETS, type CentrodePresetKey } from '../presets';

export const CENTRODES_MODULE = 'centrodes';

/** Готовая задача или своё движение (пункт 31). */
export type CentrodesKey = CentrodePresetKey | 'own';

export interface CentrodesState {
  preset: CentrodesKey;
  values: Record<string, number>;
  /** Своё движение: формулы x(φ), y(φ), θ(φ), диапазон, проверяемые уравнения. */
  own: OwnMotion;
  phi: number;
  title: string;
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}

interface Snap {
  preset: CentrodesKey;
  values: Record<string, number>;
  own: OwnMotion;
  phi: number;
  title: string;
}

const defaults = (k: CentrodesKey) => (k === 'own' ? {} : Object.fromEntries(CENTRODE_PRESETS[k].params.map((p) => [p.key, p.value])));
const srcOf = (k: CentrodesKey, values: Record<string, number>, own: OwnMotion) => (k === 'own' ? ownSource(own) : CENTRODE_PRESETS[k].build(values));
const rangeOf = (k: CentrodesKey, values: Record<string, number>, own: OwnMotion) => sourceRange(srcOf(k, values, own));
const midPhi = (k: CentrodesKey, values: Record<string, number>, own: OwnMotion) => {
  const s = srcOf(k, values, own);
  const [a, b] = s.kind === 'mech' ? [s.parts[0].from, s.parts[0].to] : sourceRange(s);
  return Math.round(((a + b) / 2) * 2) / 2;
};

export class CentrodesStore {
  private st: CentrodesState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();

  constructor(opts: { preset?: CentrodePresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm171';
    const values = defaults(k);
    this.st = {
      preset: k,
      values,
      own: { ...OWN_DEFAULT },
      phi: midPhi(k, values, OWN_DEFAULT),
      title: CENTRODE_PRESETS[k].title,
      canUndo: false,
      canRedo: false,
      notice: null,
      explain: opts.explain ?? true,
    };
  }

  get = (): CentrodesState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<CentrodesState>) {
    this.st = { ...this.st, ...patch, canUndo: this.hist.canUndo, canRedo: this.hist.canRedo };
    this.listeners.forEach((f) => f());
  }
  private snap = (): Snap => ({ preset: this.st.preset, values: this.st.values, own: this.st.own, phi: this.st.phi, title: this.st.title });
  private commit() {
    this.hist.push(this.snap());
  }
  endSession = (key: string) => this.hist.endSession(key);

  loadPreset = (k: CentrodesKey) => {
    this.commit();
    const values = defaults(k);
    this.set({ preset: k, values, phi: midPhi(k, values, this.st.own), title: k === 'own' ? 'Своё движение' : CENTRODE_PRESETS[k].title });
  };
  /** Своё движение: формула или число; правка подряд в одном поле — одна запись в истории. */
  typeOwn = <K extends keyof OwnMotion>(key: K, x: OwnMotion[K]) => {
    if (this.hist.startSession(`own:${key}`)) this.commit();
    const own = { ...this.st.own, [key]: typeof x === 'string' ? x.slice(0, 200) : x };
    this.set({ own, phi: this.clampPhi(this.st.preset, this.st.values, this.st.phi, own) });
  };
  /** Размер: правка подряд в одном поле — одна запись в истории. */
  typeValue = (key: string, x: number) => {
    if (this.hist.startSession(`val:${key}`)) this.commit();
    const values = { ...this.st.values, [key]: x };
    this.set({ values, phi: this.clampPhi(this.st.preset, values, this.st.phi) });
  };
  private clampPhi(k: CentrodesKey, values: Record<string, number>, phi: number, own = this.st.own) {
    const [a, b] = rangeOf(k, values, own);
    return b > a ? Math.min(b, Math.max(a, phi)) : phi;
  }
  setPhi = (phi: number) => this.set({ phi: this.clampPhi(this.st.preset, this.st.values, phi) });

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

  exportProject = (now = new Date()) => ({
    name: projectFileName(this.st.title, now),
    text: writeEnvelope(
      CENTRODES_MODULE,
      this.st.title,
      { preset: this.st.preset, values: this.st.values, phi: this.st.phi, ...(this.st.preset === 'own' ? { own: this.st.own } : {}) },
      now,
    ),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== CENTRODES_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const k = env.raw.preset;
    if (typeof k !== 'string' || !(k in CENTRODE_PRESETS || k === 'own')) return (this.notify(head + 'неизвестная задача (поле preset).', 'bad'), false);
    const key = k as CentrodesKey;
    const values = defaults(key);
    if (key !== 'own' && isObj(env.raw.values))
      for (const p of CENTRODE_PRESETS[key].params)
        if (isNum(env.raw.values[p.key]) && (env.raw.values[p.key] as number) > 0) values[p.key] = env.raw.values[p.key] as number;
    let own = this.st.own;
    if (key === 'own') {
      const o = env.raw.own;
      if (!isObj(o)) return (this.notify(head + 'нет формул своего движения (поле own).', 'bad'), false);
      own = { ...OWN_DEFAULT };
      for (const f of ['x', 'y', 'theta', 'eqF', 'eqM'] as const) if (typeof o[f] === 'string') own[f] = (o[f] as string).slice(0, 200);
      for (const f of ['from', 'to', 'rot'] as const) if (isNum(o[f])) own[f] = o[f] as number;
    }
    const phi = isNum(env.raw.phi) ? this.clampPhi(key, values, env.raw.phi, own) : midPhi(key, values, own);
    this.commit();
    const title = env.title ?? (key === 'own' ? 'Своё движение' : CENTRODE_PRESETS[key].title);
    this.set({ preset: key, values, own, phi, title });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
