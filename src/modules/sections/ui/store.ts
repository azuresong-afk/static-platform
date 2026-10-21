/**
 * Состояние вкладки «Подбор сечения»: исходные данные расчёта (материал, отношение h/b, откуда брать M и Q).
 * Схема балки — общая с «Балками и рамами». Файл проекта раздела — схема «Балок и рам» плюс исходные данные.
 */
import { History } from '../../../shared/history';
import { isNum, isObj, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { Store as FramesStore } from '../../frames/ui/store';

export interface SectionParams {
  /** M и Q — из эпюр балки или заданы вручную. */
  source: 'beam' | 'manual';
  M: number;
  Q: number;
  /** [σ] — задано прямо или через предел текучести и запас: [σ] = σт/n. */
  sigmaMode: 'allow' | 'yield';
  sigmaAllow: number;
  sigmaT: number;
  n: number;
  tau: number;
  /** h/b прямоугольника. */
  k: number;
  /** Допустимое перенапряжение двутавра, %. */
  overload: number;
}

export const DEFAULT_PARAMS: SectionParams = { source: 'beam', M: 20, Q: 10, sigmaMode: 'allow', sigmaAllow: 160, sigmaT: 240, n: 1.5, tau: 100, k: 2, overload: 0 };

export const SECTIONS_MODULE = 'sections';

/** Проверка исходных данных из файла; ошибки — понятным текстом. */
export function parseParams(raw: unknown): { ok: true; p: SectionParams } | { ok: false; error: string } {
  if (!isObj(raw)) return { ok: false, error: 'В файле нет исходных данных подбора сечения (section).' };
  const p = { ...DEFAULT_PARAMS };
  const pos = (k: 'M' | 'sigmaAllow' | 'sigmaT' | 'n' | 'tau' | 'k', label: string) => {
    if (!isNum(raw[k]) || (raw[k] as number) <= 0) throw new Error(`${label} должно быть положительным числом.`);
    p[k] = raw[k] as number;
  };
  try {
    if (raw.source !== 'beam' && raw.source !== 'manual') throw new Error('Источник M и Q: ожидается beam или manual.');
    if (raw.sigmaMode !== 'allow' && raw.sigmaMode !== 'yield') throw new Error('Способ задания [σ]: ожидается allow или yield.');
    p.source = raw.source;
    p.sigmaMode = raw.sigmaMode;
    pos('M', 'M');
    if (!isNum(raw.Q) || raw.Q < 0) throw new Error('Q должно быть неотрицательным числом.');
    p.Q = raw.Q;
    pos('sigmaAllow', '[σ]');
    pos('sigmaT', 'σт');
    pos('n', 'Коэффициент запаса n');
    pos('tau', '[τ]');
    pos('k', 'Отношение h/b');
    if (!isNum(raw.overload) || raw.overload < 0 || raw.overload > 20) throw new Error('Перенапряжение должно быть от 0 до 20 %.');
    p.overload = raw.overload;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  return { ok: true, p };
}

/** Допускаемое нормальное напряжение по исходным данным. */
export const sigmaOf = (p: SectionParams): number => (p.sigmaMode === 'yield' ? p.sigmaT / p.n : p.sigmaAllow);

export interface SectionsState {
  p: SectionParams;
  canUndo: boolean;
  canRedo: boolean;
}

export class SectionsStore {
  private st: SectionsState = { p: DEFAULT_PARAMS, canUndo: false, canRedo: false };
  private listeners = new Set<() => void>();
  private hist = new History<SectionParams>();

  constructor(readonly frames: FramesStore) {}

  get = (): SectionsState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(p: SectionParams) {
    this.st = { p, canUndo: this.hist.canUndo, canRedo: this.hist.canRedo };
    this.listeners.forEach((f) => f());
  }

  /** Числовое поле: правки одного поля подряд — одна запись истории. */
  typeField = <K extends keyof SectionParams>(key: K, v: SectionParams[K]) => {
    if (this.st.p[key] === v) return;
    if (this.hist.startSession(key)) this.hist.push(this.st.p);
    this.set({ ...this.st.p, [key]: v });
  };
  endSession = (key: string) => this.hist.endSession(key);
  /** Переключатель — отдельная запись истории. */
  setField = <K extends keyof SectionParams>(key: K, v: SectionParams[K]) => {
    if (this.st.p[key] === v) return;
    this.hist.push(this.st.p);
    this.set({ ...this.st.p, [key]: v });
  };
  load = (p: SectionParams) => {
    this.hist.push(this.st.p);
    this.set(p);
  };
  undo = () => {
    const prev = this.hist.undo(this.st.p);
    if (prev) this.set(prev);
  };
  redo = () => {
    const next = this.hist.redo(this.st.p);
    if (next) this.set(next);
  };

  /** Файл раздела: схема «Балок и рам» и исходные данные подбора. */
  exportProject = (now = new Date()): { name: string; text: string } => {
    const f = this.frames.exportProject(now);
    const raw = JSON.parse(f.text) as Record<string, unknown>;
    return { name: f.name, text: writeEnvelope(SECTIONS_MODULE, raw.title as string, { structure: raw.structure, notTarget: raw.notTarget, section: this.st.p }, now) };
  };
  /** Открыть файл раздела или файл «Балок и рам» (тогда исходные данные не меняются). */
  importProject = (text: string, fileName?: string): boolean => {
    const env = readEnvelope(text);
    if (!env.ok || env.module !== SECTIONS_MODULE) return this.frames.importProject(text, fileName);
    const pp = parseParams(env.raw.section);
    if (!pp.ok) {
      this.frames.notify(`Не удалось открыть ${fileName ? `«${fileName}»` : 'файл'}: ${pp.error}`, 'bad');
      return false;
    }
    if (!this.frames.importProject(JSON.stringify({ ...env.raw, module: 'frames' }), fileName)) return false;
    this.load(pp.p);
    return true;
  };
}
