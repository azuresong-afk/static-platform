/**
 * Состояние интерфейса и история отмены (перенос логики прототипа).
 * - Каждое изменение сначала кладёт снимок в историю (commit), затем меняет состояние.
 * - Ввод в одно поле — одна запись истории (сессия правки до потери фокуса).
 * - Состояние конструкции всегда хранится после resolve(): элементы на существующих узлах,
 *   углы опор синхронизированы — как прототип, который правит состояние при каждом пересчёте.
 */
import { addItem, addSeg, removeSeg, setSegDir, setSegLen, splitSeg, type EditResult } from '../model/edit';
import { resolve } from '../model/geometry';
import { createIdGen, type IdGen } from '../model/ids';
import { loadPreset, type PresetKey } from '../model/presets';
import type { Dir, Item, ItemType, RefDir, Structure } from '../model/types';
import type { View } from '../draw/drawing';
import { clamp } from '../model/format';

export type PresetValue = PresetKey | 'custom';

export interface AppState {
  s: Structure;
  /** Неизвестные, снятые с «Что найти». */
  nt: string[];
  preset: PresetValue;
  view: View;
  sel: string | null;
  wiz: { on: boolean; step: number };
  canUndo: boolean;
  canRedo: boolean;
  /** Сообщение под участками; seq меняется при каждом показе. */
  msg: { text: string; seq: number };
  explain: boolean;
}

export const WSTEPS = 5;
const HIST_MAX = 300;

interface Snap {
  nodes: Structure['nodes'];
  segs: Structure['segs'];
  items: Structure['items'];
  nt: string[];
  preset: PresetValue;
}

export class Store {
  private st: AppState;
  private listeners = new Set<() => void>();
  private hist = { u: [] as string[], r: [] as string[] };
  private session: string | null = null;
  private msgTimer: ReturnType<typeof setTimeout> | null = null;
  readonly ids: IdGen;

  constructor(opts: { preset?: PresetKey; explain?: boolean; ids?: IdGen } = {}) {
    this.ids = opts.ids ?? createIdGen();
    const preset = opts.preset ?? 'simple';
    this.st = {
      s: resolve(loadPreset(preset, this.ids)).structure,
      nt: [],
      preset,
      view: 'construct',
      sel: null,
      wiz: { on: preset === 'blank', step: 1 },
      canUndo: false,
      canRedo: false,
      msg: { text: '', seq: 0 },
      explain: opts.explain ?? true,
    };
  }

  /* ---------- подписка (для useSyncExternalStore) ---------- */
  get = (): AppState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<AppState>) {
    const next = { ...this.st, ...patch };
    if (patch.s) {
      next.s = resolve(patch.s).structure;
      if (next.sel && !next.s.items.some((i) => i.id === next.sel)) next.sel = null;
    }
    next.canUndo = this.hist.u.length > 0;
    next.canRedo = this.hist.r.length > 0;
    this.st = next;
    this.listeners.forEach((f) => f());
  }

  /* ---------- история ---------- */
  private snap(): string {
    const { s, nt, preset } = this.st;
    const o: Snap = { nodes: s.nodes, segs: s.segs, items: s.items, nt, preset };
    return JSON.stringify(o);
  }
  /** Запомнить текущее состояние перед изменением; схема становится «своей». */
  private commit() {
    this.hist.u.push(this.snap());
    if (this.hist.u.length > HIST_MAX) this.hist.u.shift();
    this.hist.r = [];
    this.st = { ...this.st, preset: 'custom' };
  }
  /** Начало правки поля: первая правка в поле — одна запись истории. */
  private touch(key: string) {
    if (this.session !== key) {
      this.session = key;
      this.commit();
    }
  }
  /** Поле потеряло фокус — следующая правка в нём будет новой записью истории. */
  endSession = (key: string) => {
    if (this.session === key) this.session = null;
  };
  private restore(str: string) {
    const o = JSON.parse(str) as Snap;
    this.session = null;
    this.set({ s: { nodes: o.nodes, segs: o.segs, items: o.items }, nt: o.nt, preset: o.preset });
  }
  undo = () => {
    const prev = this.hist.u.pop();
    if (prev === undefined) return;
    this.hist.r.push(this.snap());
    this.restore(prev);
  };
  redo = () => {
    const next = this.hist.r.pop();
    if (next === undefined) return;
    this.hist.u.push(this.snap());
    this.restore(next);
  };

  /* ---------- сообщения ---------- */
  flash = (text: string) => {
    if (this.msgTimer) clearTimeout(this.msgTimer);
    this.set({ msg: { text, seq: this.st.msg.seq + 1 } });
    this.msgTimer = setTimeout(() => this.set({ msg: { text: '', seq: this.st.msg.seq + 1 } }), 4500);
  };

  /* ---------- готовые задачи и вид ---------- */
  loadPreset = (k: PresetKey) => {
    this.commit();
    const wiz = k === 'blank' ? { on: true, step: 1 } : { on: false, step: this.st.wiz.step };
    this.set({ s: loadPreset(k, this.ids), nt: [], preset: k, sel: null, wiz });
  };
  setView = (view: View) => this.set({ view });
  setExplain = (explain: boolean) => this.set({ explain });
  select = (sel: string | null) => {
    if (sel !== this.st.sel) this.set({ sel });
  };

  /* ---------- участки ---------- */
  private applyEdit(r: EditResult): boolean {
    if (!r.ok) {
      if (r.msg) this.flash(r.msg);
      return false;
    }
    this.commit();
    this.set({ s: r.s });
    return true;
  }
  addSeg = (from: string, dir: Dir, len: number) => this.applyEdit(addSeg(this.st.s, from, dir, len, this.ids));
  splitSeg = (segId: string, t: number) => this.applyEdit(splitSeg(this.st.s, segId, t, this.ids));
  removeSeg = (segId: string) => this.applyEdit(removeSeg(this.st.s, segId));
  setSegDir = (segId: string, dir: Dir) => this.applyEdit(setSegDir(this.st.s, segId, dir));
  /** Длина из поля списка участков: каждая корректная правка сразу применяется, вся правка поля — одна запись. */
  typeSegLen = (segId: string, v: number): boolean => {
    const r = setSegLen(this.st.s, segId, v);
    if (!r.ok) {
      if (r.reason === 'noop') return true;
      if (r.msg) this.flash(r.msg);
      return false;
    }
    this.touch('seg:' + segId);
    this.set({ s: r.s });
    return true;
  };
  /** Длина из поля на чертеже (по Enter или потере фокуса). */
  commitSegLen = (segId: string, v: number) => {
    const r = setSegLen(this.st.s, segId, v);
    if (r.ok) this.applyEdit(r);
    else if (r.msg) this.flash(r.msg);
  };

  /* ---------- элементы ---------- */
  addItem = (type: ItemType) => {
    this.commit();
    const r = addItem(this.st.s, type, this.ids);
    this.set({ s: r.s, sel: r.id });
  };
  deleteItem = (id: string) => {
    this.commit();
    this.set({ s: { ...this.st.s, items: this.st.s.items.filter((i) => i.id !== id) }, sel: this.st.sel === id ? null : this.st.sel });
  };
  private patchItem(id: string, patch: Partial<Item>) {
    const items = this.st.s.items.map((i) => (i.id === id ? ({ ...i, ...patch } as Item) : i));
    this.set({ s: { ...this.st.s, items } });
  }
  /** Числовое поле карточки: правки поля — одна запись истории. */
  typeItemField = (id: string, f: string, v: number) => {
    this.touch('item:' + id + ':' + f);
    this.patchItem(id, { [f]: v } as Partial<Item>);
  };
  /** Выпадающий список или флажок карточки. */
  setItemField = (id: string, f: string, v: unknown) => {
    this.commit();
    this.patchItem(id, { [f]: v } as Partial<Item>);
  };
  /** Кнопки «Без угла»: направление силы без наклона. */
  setForceDir = (id: string, ref: RefDir) => {
    const it = this.st.s.items.find((i) => i.id === id);
    if (!it || it.type !== 'force') return;
    if (it.ref === ref && !+it.alpha) return;
    this.commit();
    this.patchItem(id, { ref, alpha: 0 } as Partial<Item>);
  };
  /** Перетаскивание: первое перемещение — запись истории, дальше элемент просто следует за указателем. */
  moveItem = (id: string, at: string, first: boolean) => {
    const it = this.st.s.items.find((i) => i.id === id);
    if (!it || it.type === 'dist' || it.at === at) return false;
    if (first) this.commit();
    this.patchItem(id, { at } as Partial<Item>);
    return true;
  };
  setTarget = (key: string, target: boolean) => {
    this.commit();
    const nt = this.st.nt.filter((k) => k !== key);
    if (!target) nt.push(key);
    this.set({ nt });
  };

  /* ---------- мастер ---------- */
  setStep = (n: number) => this.set({ wiz: { on: true, step: clamp(n, 1, WSTEPS) } });
  stopWiz = () => this.set({ wiz: { on: false, step: this.st.wiz.step } });
}
