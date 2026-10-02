/** Состояние вкладки «Тонкостенные сосуды»: участки, нагрузка, опоры; история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { SegKind, Segment, VesselProblem } from '../model/vessel';
import { VESSEL_PRESETS, type VesselPresetKey } from '../presets';

export const VESSEL_MODULE = 'vessels';
export const MAX_SEGS = 8;
const NUM = ['pg', 'rho', 'level', 'zs', 'sigma', 'g'] as const;
export type VesselNumKey = (typeof NUM)[number];
const KINDS: SegKind[] = ['cyl', 'cone', 'sph', 'ell'];

export interface VesselState {
  problem: VesselProblem;
  title: string;
  preset: VesselPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: VesselProblem;
  title: string;
  preset: VesselState['preset'];
}
const copy = (p: VesselProblem): VesselProblem => structuredClone(p);

export function parseVessel(raw: unknown): { ok: true; problem: VesselProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !Array.isArray(raw.segs) || !NUM.every((k) => isNum(raw[k])) || !['ground', 'lugs'].includes(raw.support as string)) return { ok: false, errors: ['В файле нет сосуда (problem с полями segs, pg, rho, level, support, zs, sigma).'] };
  const segs = raw.segs as unknown[];
  if (!segs.length || segs.length > MAX_SEGS || !segs.every((s) => isObj(s) && KINDS.includes(s.kind as SegKind) && ['r1', 'r2', 'p', 'h'].every((k) => isNum(s[k])))) return { ok: false, errors: [`Участки: от 1 до ${MAX_SEGS}, у каждого kind, r1, r2, p, h.`] };
  const n = Object.fromEntries(NUM.map((k) => [k, raw[k]])) as Record<VesselNumKey, number>;
  return { ok: true, problem: { segs: segs.map((s) => ({ ...(s as Segment) })).map(({ kind, r1, r2, p, h }) => ({ kind, r1, r2, p, h })), support: raw.support as 'ground' | 'lugs', ...n } };
}

/** Новый участок продолжает предыдущий по радиусу. */
export function newSeg(kind: SegKind, rTop: number): Segment {
  const r = rTop > 0 ? rTop : 1;
  if (kind === 'cyl') return { kind, r1: r, r2: r, p: 0, h: 2 };
  if (kind === 'cone') return { kind, r1: rTop, r2: rTop > 0 ? 0 : 1, p: 30, h: 0 };
  if (kind === 'sph') return { kind, r1: rTop, r2: rTop > 0 ? 0 : 1, p: r, h: 0 };
  return { kind, r1: rTop, r2: rTop > 0 ? 0 : 1, p: 0, h: r / 2 };
}

export class VesselStore {
  private st: VesselState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: VesselPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'a1';
    this.st = { problem: copy(VESSEL_PRESETS[k].problem as VesselProblem), title: VESSEL_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): VesselState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<VesselState>) {
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
  private edit(fn: (p: VesselProblem) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  private change(fn: (p: VesselProblem) => void) {
    this.commit();
    this.edit(fn);
  }
  loadPreset = (k: VesselPresetKey) => {
    this.commit();
    this.set({ problem: copy(VESSEL_PRESETS[k].problem as VesselProblem), title: VESSEL_PRESETS[k].title, preset: k });
  };
  typeNum = (k: VesselNumKey, v: number) => {
    this.touch(`n:${k}`);
    this.edit((p) => (p[k] = v));
  };
  typeSeg = (i: number, k: 'r1' | 'r2' | 'p' | 'h', v: number) => {
    this.touch(`s:${i}:${k}`);
    this.edit((p) => {
      p.segs[i][k] = v;
      if (p.segs[i].kind === 'cyl' && k === 'r1') p.segs[i].r2 = v;
    });
  };
  setSegKind = (i: number, kind: SegKind) =>
    this.change((p) => {
      const prev = i > 0 ? p.segs[i - 1] : null;
      p.segs[i] = newSeg(kind, prev ? (prev.kind === 'cyl' ? prev.r1 : prev.r2) : p.segs[i].r1);
    });
  addSeg = (kind: SegKind) => {
    if (this.st.problem.segs.length >= MAX_SEGS) return;
    this.change((p) => {
      const last = p.segs[p.segs.length - 1];
      p.segs.push(newSeg(kind, last ? (last.kind === 'cyl' ? last.r1 : last.r2) : 1));
    });
  };
  removeSeg = (i: number) => this.st.problem.segs.length > 1 && this.change((p) => p.segs.splice(i, 1));
  setSupport = (s: 'ground' | 'lugs') => s !== this.st.problem.support && this.change((p) => (p.support = s));
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
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(VESSEL_MODULE, this.st.title, { problem: this.st.problem }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== VESSEL_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseVessel(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Тонкостенный сосуд';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
