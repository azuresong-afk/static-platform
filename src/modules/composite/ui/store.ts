/** Состояние вкладки «Составное сечение»: части, момент M (необязательно), история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import { PROFILE_NOS } from '../model/profiles';
import type { Part } from '../model/section';
import { COMPOSITE_PRESETS, type CompositePresetKey } from '../presets';

export const COMPOSITE_MODULE = 'composite';
const MAX_PARTS = 8;

export interface CompositeState {
  parts: Part[];
  /** Изгибающий момент, кН·м (0 — напряжения через M). */
  M: number;
  title: string;
  preset: CompositePresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}

interface Snap {
  parts: Part[];
  M: number;
  title: string;
  preset: CompositeState['preset'];
}

export function parseParts(raw: unknown): { ok: true; parts: Part[] } | { ok: false; errors: string[] } {
  if (!Array.isArray(raw) || !raw.length || raw.length > MAX_PARTS) return { ok: false, errors: [`Частей сечения должно быть от 1 до ${MAX_PARTS}.`] };
  const errors: string[] = [];
  const parts: Part[] = [];
  raw.forEach((p: unknown, i) => {
    const bad = (m: string) => errors.push(`Часть №${i + 1}: ${m}`);
    if (!isObj(p)) return bad('неверные данные.');
    if (!['plate', 'ibeam', 'channel', 'angle'].includes(p.kind as string)) return bad('неизвестный вид.');
    const kind = p.kind as Part['kind'];
    if (kind !== 'plate' && !PROFILE_NOS[kind].includes(p.no as string)) return bad(`нет профиля «${String(p.no)}» в сортаменте.`);
    if (kind === 'plate' && !(isNum(p.w) && p.w > 0 && isNum(p.h) && p.h > 0)) return bad('размеры листа — положительные числа.');
    if (![0, 90, 180, 270].includes(p.rot as number)) return bad('разворот — 0, 90, 180 или 270.');
    if (typeof p.mirror !== 'boolean' || !isNum(p.x) || !isNum(p.y)) return bad('положение — числа, отражение — true или false.');
    parts.push({ kind, no: kind === 'plate' ? '' : (p.no as string), w: kind === 'plate' ? (p.w as number) : 0, h: kind === 'plate' ? (p.h as number) : 0, rot: p.rot as Part['rot'], mirror: p.mirror, x: p.x, y: p.y });
  });
  return errors.length ? { ok: false, errors } : { ok: true, parts };
}

export class CompositeStore {
  private st: CompositeState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();

  constructor(opts: { preset?: CompositePresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 's1';
    this.st = { parts: COMPOSITE_PRESETS[k].parts, M: 0, title: COMPOSITE_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }

  get = (): CompositeState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<CompositeState>) {
    this.st = { ...this.st, ...patch, canUndo: this.hist.canUndo, canRedo: this.hist.canRedo };
    this.listeners.forEach((f) => f());
  }
  private snap = (): Snap => ({ parts: this.st.parts, M: this.st.M, title: this.st.title, preset: this.st.preset });
  private commit() {
    this.hist.push(this.snap());
    if (this.st.preset !== 'custom') this.st = { ...this.st, preset: 'custom', title: 'Своё сечение' };
  }
  private touch(key: string) {
    if (this.hist.startSession(key)) this.commit();
  }
  endSession = (key: string) => this.hist.endSession(key);

  loadPreset = (k: CompositePresetKey) => {
    this.commit();
    this.set({ parts: COMPOSITE_PRESETS[k].parts, title: COMPOSITE_PRESETS[k].title, preset: k });
  };
  /** Выбор вида, номера, разворота, отражения — отдельная запись истории. */
  setPart = (i: number, patch: Partial<Part>) => {
    this.commit();
    this.set({
      parts: this.st.parts.map((p, j) => {
        if (j !== i) return p;
        const next = { ...p, ...patch };
        // При смене вида — первый номер сортамента или лист 100×10.
        if (patch.kind && patch.kind !== p.kind) {
          if (patch.kind === 'plate') Object.assign(next, { no: '', w: 100, h: 10 });
          else Object.assign(next, { no: PROFILE_NOS[patch.kind][4] ?? PROFILE_NOS[patch.kind][0], w: 0, h: 0 });
        }
        return next;
      }),
    });
  };
  /** Числовое поле части (положение, размеры листа). */
  typePart = (i: number, key: 'x' | 'y' | 'w' | 'h', v: number) => {
    this.touch(`part:${i}:${key}`);
    this.set({ parts: this.st.parts.map((p, j) => (j === i ? { ...p, [key]: v } : p)) });
  };
  addPart = () => {
    if (this.st.parts.length >= MAX_PARTS) return;
    this.commit();
    this.set({ parts: [...this.st.parts, { kind: 'plate', no: '', w: 100, h: 10, rot: 0, mirror: false, x: -50, y: -10 }] });
  };
  removePart = (i: number) => {
    if (this.st.parts.length <= 1) return;
    this.commit();
    this.set({ parts: this.st.parts.filter((_, j) => j !== i) });
  };
  typeM = (M: number) => {
    this.touch('M');
    this.set({ M });
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

  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(COMPOSITE_MODULE, this.st.title, { parts: this.st.parts, M: this.st.M }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== COMPOSITE_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseParts(env.raw.parts);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    const M = isNum(env.raw.M) ? env.raw.M : 0;
    this.commit();
    const title = env.title ?? 'Сечение';
    this.set({ parts: r.parts, M, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
