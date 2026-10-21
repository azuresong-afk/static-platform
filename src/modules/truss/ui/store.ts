/** Состояние вкладки «Фермы»: ферма, стержень для метода Риттера, история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { Truss, TrussLoad, TrussNode, TrussSupport } from '../model/truss';
import { TRUSS_PRESETS, type TrussPresetKey } from '../presets';

export const TRUSS_MODULE = 'truss';
const MAX_NODES = 30;

export interface TrussState {
  truss: Truss;
  ritter: number | null;
  title: string;
  preset: TrussPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}

interface Snap {
  truss: Truss;
  ritter: number | null;
  title: string;
  preset: TrussState['preset'];
}

const copy = (t: Truss): Truss => structuredClone(t);

/** Разбор фермы из файла проекта с понятными сообщениями. */
export function parseTruss(raw: unknown): { ok: true; truss: Truss } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !Array.isArray(raw.nodes) || !Array.isArray(raw.bars) || !Array.isArray(raw.supports) || !Array.isArray(raw.loads))
    return { ok: false, errors: ['В файле нет фермы (truss с полями nodes, bars, supports, loads).'] };
  const errors: string[] = [];
  const n = raw.nodes.length;
  if (n < 2 || n > MAX_NODES) errors.push(`Узлов должно быть от 2 до ${MAX_NODES}.`);
  const idx = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;
  const nodes: TrussNode[] = [];
  raw.nodes.forEach((p: unknown, i) => (isObj(p) && isNum(p.x) && isNum(p.y) ? nodes.push({ x: p.x, y: p.y }) : errors.push(`Узел №${i + 1}: координаты x, y — числа.`)));
  const bars = raw.bars.flatMap((q: unknown, k) => (isObj(q) && idx(q.a) && idx(q.b) ? [{ a: q.a as number, b: q.b as number }] : (errors.push(`Стержень №${k + 1}: номера узлов a, b.`), [])));
  const supports: TrussSupport[] = raw.supports.flatMap((s: unknown, j) =>
    isObj(s) && idx(s.node) && (s.kind === 'pin' || s.kind === 'roller') && isNum(s.angle)
      ? [{ node: s.node as number, kind: s.kind, angle: s.angle }]
      : (errors.push(`Опора №${j + 1}: узел, вид (pin или roller) и угол.`), []),
  );
  const loads: TrussLoad[] = raw.loads.flatMap((l: unknown, j) =>
    isObj(l) && idx(l.node) && isNum(l.F) && isNum(l.angle) ? [{ node: l.node as number, F: l.F, angle: l.angle }] : (errors.push(`Сила №${j + 1}: узел, модуль F и угол.`), []),
  );
  return errors.length ? { ok: false, errors } : { ok: true, truss: { nodes, bars, supports, loads } };
}

export class TrussStore {
  private st: TrussState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();

  constructor(opts: { preset?: TrussPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm57';
    const p = TRUSS_PRESETS[k];
    this.st = { truss: copy(p.truss as Truss), ritter: p.ritter, title: p.title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }

  get = (): TrussState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<TrussState>) {
    this.st = { ...this.st, ...patch, canUndo: this.hist.canUndo, canRedo: this.hist.canRedo };
    this.listeners.forEach((f) => f());
  }
  private snap = (): Snap => ({ truss: this.st.truss, ritter: this.st.ritter, title: this.st.title, preset: this.st.preset });
  private commit() {
    this.hist.push(this.snap());
    if (this.st.preset !== 'custom') this.st = { ...this.st, preset: 'custom', title: 'Своя ферма' };
  }
  private touch(key: string) {
    if (this.hist.startSession(key)) this.commit();
  }
  endSession = (key: string) => this.hist.endSession(key);
  private edit(fn: (t: Truss) => void, patch: Partial<TrussState> = {}) {
    const t = copy(this.st.truss);
    fn(t);
    this.set({ truss: t, ...patch });
  }

  loadPreset = (k: TrussPresetKey) => {
    this.commit();
    const p = TRUSS_PRESETS[k];
    this.set({ truss: copy(p.truss as Truss), ritter: p.ritter, title: p.title, preset: k });
  };

  /* узлы */
  typeNode = (i: number, key: 'x' | 'y', v: number) => {
    this.touch(`node:${i}:${key}`);
    this.edit((t) => (t.nodes[i][key] = v));
  };
  addNode = () => {
    if (this.st.truss.nodes.length >= MAX_NODES) return;
    this.commit();
    const ns = this.st.truss.nodes;
    this.edit((t) => t.nodes.push({ x: Math.max(...ns.map((n) => n.x)) + 2, y: 0 }));
  };
  /** Убрать узел вместе со стержнями, опорами и силами в нём; номера следующих узлов сдвигаются. */
  removeNode = (i: number) => {
    if (this.st.truss.nodes.length <= 2) return;
    this.commit();
    const sh = (j: number) => (j > i ? j - 1 : j);
    const oldBars = this.st.truss.bars;
    const keep = oldBars.map((q) => q.a !== i && q.b !== i);
    const ritter = this.st.ritter;
    const newRitter = ritter != null && keep[ritter] ? keep.slice(0, ritter).filter(Boolean).length : null;
    this.edit(
      (t) => {
        t.nodes.splice(i, 1);
        t.bars = oldBars.filter((_, k) => keep[k]).map((q) => ({ a: sh(q.a), b: sh(q.b) }));
        t.supports = t.supports.filter((s) => s.node !== i).map((s) => ({ ...s, node: sh(s.node) }));
        t.loads = t.loads.filter((l) => l.node !== i).map((l) => ({ ...l, node: sh(l.node) }));
      },
      { ritter: newRitter },
    );
  };

  /* стержни */
  addBar = () => {
    const t = this.st.truss;
    // Первая пара узлов, ещё не соединённая стержнем.
    for (let a = 0; a < t.nodes.length; a++)
      for (let b = a + 1; b < t.nodes.length; b++)
        if (!t.bars.some((q) => (q.a === a && q.b === b) || (q.a === b && q.b === a))) {
          this.commit();
          this.edit((x) => x.bars.push({ a, b }));
          return;
        }
    this.notify('Все узлы уже соединены стержнями попарно.', 'bad');
  };
  setBar = (k: number, end: 'a' | 'b', node: number) => {
    this.commit();
    this.edit((t) => (t.bars[k][end] = node));
  };
  removeBar = (k: number) => {
    this.commit();
    const r = this.st.ritter;
    this.edit((t) => t.bars.splice(k, 1), { ritter: r == null || r === k ? null : r > k ? r - 1 : r });
  };

  /* опоры и силы */
  addSupport = () => {
    this.commit();
    this.edit((t) => t.supports.push({ node: 0, kind: t.supports.length ? 'roller' : 'pin', angle: 90 }));
  };
  setSupport = (j: number, patch: Partial<TrussSupport>) => {
    this.commit();
    this.edit((t) => Object.assign(t.supports[j], patch));
  };
  typeSupportAngle = (j: number, v: number) => {
    this.touch(`sup:${j}`);
    this.edit((t) => (t.supports[j].angle = v));
  };
  removeSupport = (j: number) => {
    this.commit();
    this.edit((t) => t.supports.splice(j, 1));
  };
  addLoad = () => {
    this.commit();
    this.edit((t) => t.loads.push({ node: Math.min(2, t.nodes.length - 1), F: 1, angle: 270 }));
  };
  setLoad = (j: number, patch: Partial<TrussLoad>) => {
    this.commit();
    this.edit((t) => Object.assign(t.loads[j], patch));
  };
  typeLoad = (j: number, key: 'F' | 'angle', v: number) => {
    this.touch(`load:${j}:${key}`);
    this.edit((t) => (t.loads[j][key] = v));
  };
  removeLoad = (j: number) => {
    this.commit();
    this.edit((t) => t.loads.splice(j, 1));
  };
  setRitter = (k: number | null) => {
    if (k === this.st.ritter) return;
    this.commit();
    this.set({ ritter: k });
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

  exportProject = (now = new Date()) => ({
    name: projectFileName(this.st.title, now),
    text: writeEnvelope(TRUSS_MODULE, this.st.title, { truss: this.st.truss, ritter: this.st.ritter }, now),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== TRUSS_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseTruss(env.raw.truss);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    const rt = env.raw.ritter;
    const ritter = Number.isInteger(rt) && (rt as number) >= 0 && (rt as number) < r.truss.bars.length ? (rt as number) : null;
    this.commit();
    const title = env.title ?? 'Ферма';
    this.set({ truss: r.truss, ritter, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
