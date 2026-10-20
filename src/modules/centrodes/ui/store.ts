/** Состояние вкладки «Центроиды»: готовая задача, размеры, текущее φ, история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import { sourceRange } from '../model/centrodes';
import { CENTRODE_PRESETS, type CentrodePresetKey } from '../presets';

export const CENTRODES_MODULE = 'centrodes';

export interface CentrodesState {
  preset: CentrodePresetKey;
  values: Record<string, number>;
  phi: number;
  title: string;
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}

interface Snap {
  preset: CentrodePresetKey;
  values: Record<string, number>;
  phi: number;
  title: string;
}

const defaults = (k: CentrodePresetKey) => Object.fromEntries(CENTRODE_PRESETS[k].params.map((p) => [p.key, p.value]));
const rangeOf = (k: CentrodePresetKey, values: Record<string, number>) => sourceRange(CENTRODE_PRESETS[k].build(values));
const midPhi = (k: CentrodePresetKey, values: Record<string, number>) => {
  const s = CENTRODE_PRESETS[k].build(values);
  const [a, b] = s.kind === 'mech' ? [s.parts[0].from, s.parts[0].to] : rangeOf(k, values);
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
      phi: midPhi(k, values),
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
  private snap = (): Snap => ({ preset: this.st.preset, values: this.st.values, phi: this.st.phi, title: this.st.title });
  private commit() {
    this.hist.push(this.snap());
  }
  endSession = (key: string) => this.hist.endSession(key);

  loadPreset = (k: CentrodePresetKey) => {
    this.commit();
    const values = defaults(k);
    this.set({ preset: k, values, phi: midPhi(k, values), title: CENTRODE_PRESETS[k].title });
  };
  /** Размер: правка подряд в одном поле — одна запись в истории. */
  typeValue = (key: string, x: number) => {
    if (this.hist.startSession(`val:${key}`)) this.commit();
    const values = { ...this.st.values, [key]: x };
    this.set({ values, phi: this.clampPhi(this.st.preset, values, this.st.phi) });
  };
  private clampPhi(k: CentrodePresetKey, values: Record<string, number>, phi: number) {
    const [a, b] = rangeOf(k, values);
    return Math.min(b, Math.max(a, phi));
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
    text: writeEnvelope(CENTRODES_MODULE, this.st.title, { preset: this.st.preset, values: this.st.values, phi: this.st.phi }, now),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== CENTRODES_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const k = env.raw.preset;
    if (typeof k !== 'string' || !(k in CENTRODE_PRESETS)) return (this.notify(head + 'неизвестная задача (поле preset).', 'bad'), false);
    const key = k as CentrodePresetKey;
    const values = defaults(key);
    if (isObj(env.raw.values))
      for (const p of CENTRODE_PRESETS[key].params)
        if (isNum(env.raw.values[p.key]) && (env.raw.values[p.key] as number) > 0) values[p.key] = env.raw.values[p.key] as number;
    const phi = isNum(env.raw.phi) ? this.clampPhi(key, values, env.raw.phi) : midPhi(key, values);
    this.commit();
    const title = env.title ?? CENTRODE_PRESETS[key].title;
    this.set({ preset: key, values, phi, title });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
