/**
 * Состояние интерфейса и история отмены (перенос логики прототипа).
 * - Каждое изменение сначала кладёт снимок в историю (commit), затем меняет состояние.
 * - Ввод в одно поле — одна запись истории (сессия правки до потери фокуса).
 * - Состояние конструкции всегда хранится после resolve(): элементы на существующих узлах,
 *   углы опор синхронизированы — как прототип, который правит состояние при каждом пересчёте.
 */
import {
  addBody,
  addItem,
  addLink,
  addSeg,
  addSegXY,
  patchLink,
  removeBody,
  removeLink,
  removeSeg,
  setBodyPlace,
  setSegAng,
  setSegDir,
  setSegLen,
  splitSeg,
  type EditResult,
} from '../model/edit';
import { resolve } from '../model/geometry';
import { createIdGen, type IdGen } from '../../../shared/ids';
import { loadPreset, PRESET_TITLES, type PresetKey } from '../model/presets';
import { parseProject, projectFileName, remapIds, serializeProject } from '../model/project';
import type { Item, ItemType, Link, RefDir, Search, SearchBind, SegDir, Structure } from '../model/types';
import { searchFields } from '../model/search';
import type { View } from '../draw/drawing';
import { clamp } from '../../../shared/format';
import { History } from '../../../shared/history';

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
  /** Уведомление над чертежом (открытие и сохранение файлов). */
  notice: { text: string; tone: 'ok' | 'bad'; seq: number } | null;
  /** Название проекта: готовая задача, имя открытого файла или «Своя схема». */
  title: string;
  explain: boolean;
  /** Поиск положения равновесия: какой корень (границу) показать; −1 — первый подходящий. */
  pick: number;
}

export const WSTEPS = 5;
const HIST_MAX = 300;

interface Snap {
  nodes: Structure['nodes'];
  segs: Structure['segs'];
  items: Structure['items'];
  links?: Structure['links'];
  search?: Structure['search'];
  nt: string[];
  preset: PresetValue;
  title: string;
}

export class Store {
  private st: AppState;
  private listeners = new Set<() => void>();
  private hist = new History<string>(HIST_MAX);
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
      notice: null,
      title: PRESET_TITLES[preset],
      explain: opts.explain ?? true,
      pick: -1,
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
    next.canUndo = this.hist.canUndo;
    next.canRedo = this.hist.canRedo;
    this.st = next;
    this.listeners.forEach((f) => f());
  }

  /* ---------- история ---------- */
  private snap(): string {
    const { s, nt, preset, title } = this.st;
    const o: Snap = {
      nodes: s.nodes,
      segs: s.segs,
      items: s.items,
      ...(s.links ? { links: s.links } : {}),
      ...(s.search ? { search: s.search } : {}),
      nt,
      preset,
      title,
    };
    return JSON.stringify(o);
  }
  /** Запомнить текущее состояние перед изменением; схема становится «своей». */
  private commit() {
    this.hist.push(this.snap());
    this.st = { ...this.st, preset: 'custom', title: this.st.preset === 'custom' ? this.st.title : 'Своя схема' };
  }
  /** Начало правки поля: первая правка в поле — одна запись истории. */
  private touch(key: string) {
    if (this.hist.startSession(key)) this.commit();
  }
  /** Поле потеряло фокус — следующая правка в нём будет новой записью истории. */
  endSession = (key: string) => this.hist.endSession(key);
  private restore(str: string) {
    const o = JSON.parse(str) as Snap;
    this.set({
      s: { nodes: o.nodes, segs: o.segs, items: o.items, ...(o.links ? { links: o.links } : {}), ...(o.search ? { search: o.search } : {}) },
      nt: o.nt,
      preset: o.preset,
      title: o.title,
    });
  }
  undo = () => {
    const prev = this.hist.undo(this.snap());
    if (prev !== undefined) this.restore(prev);
  };
  redo = () => {
    const next = this.hist.redo(this.snap());
    if (next !== undefined) this.restore(next);
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
    this.set({ s: loadPreset(k, this.ids), nt: [], preset: k, title: PRESET_TITLES[k], sel: null, wiz, pick: -1 });
  };

  /** Загрузить готовую схему другого раздела (например, задачу вкладки «Изгиб»). Отменяется одним шагом. */
  loadStructure = (structure: Structure, title: string) => {
    this.commit();
    this.set({ s: structure, nt: [], preset: 'custom', title, sel: null, wiz: { on: false, step: this.st.wiz.step }, pick: -1 });
  };

  /* ---------- файлы проекта ---------- */
  /** Содержимое файла проекта и предлагаемое имя. */
  exportProject = (now = new Date()): { name: string; text: string } => {
    const { s, nt, title } = this.st;
    return { name: projectFileName(title, now), text: serializeProject({ title, structure: s, notTarget: nt }, now) };
  };
  /** Открыть проект из текста файла. Открытие отменяется, как любое изменение. */
  importProject = (text: string, fileName?: string): boolean => {
    const r = parseProject(text);
    if (!r.ok) {
      const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
      this.notify(head + r.errors.slice(0, 5).join(' ') + (r.errors.length > 5 ? ` …и ещё ${r.errors.length - 5}.` : ''), 'bad');
      return false;
    }
    this.commit();
    const p = r.project;
    this.set({ s: remapIds(p.structure, this.ids), nt: p.notTarget, preset: 'custom', title: p.title, sel: null, wiz: { on: false, step: 1 }, pick: -1 });
    this.notify(`Открыт проект «${p.title}».`, 'ok');
    return true;
  };
  setTitle = (title: string) => this.set({ title });
  projectTitle = () => this.st.title;
  notify = (text: string, tone: 'ok' | 'bad' = 'ok') => this.set({ notice: { text, tone, seq: (this.st.notice?.seq ?? 0) + 1 } });
  closeNotice = () => this.set({ notice: null });
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
  addSeg = (from: string, dir: SegDir, len: number, ang?: number) => this.applyEdit(addSeg(this.st.s, from, dir, len, this.ids, ang));
  /** Участок по проекциям на оси (наклонный — с точной длиной √(dx² + dy²)). */
  addSegXY = (from: string, dx: number, dy: number) => this.applyEdit(addSegXY(this.st.s, from, dx, dy, this.ids));
  splitSeg = (segId: string, t: number) => this.applyEdit(splitSeg(this.st.s, segId, t, this.ids));
  removeSeg = (segId: string) => this.applyEdit(removeSeg(this.st.s, segId));
  setSegDir = (segId: string, dir: SegDir, ang?: number) => this.applyEdit(setSegDir(this.st.s, segId, dir, ang));
  /** Угол наклонного участка из поля списка: вся правка поля — одна запись истории. */
  typeSegAng = (segId: string, ang: number): boolean => {
    const r = setSegAng(this.st.s, segId, ang);
    if (!r.ok) {
      if (r.reason === 'noop') return true;
      if (r.msg) this.flash(r.msg);
      return false;
    }
    this.touch('segang:' + segId);
    this.set({ s: r.s });
    return true;
  };
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

  /** Внутренний шарнир в точке: включить или выключить. */
  setHinge = (nodeId: string, on: boolean) => {
    const n = this.st.s.nodes.find((x) => x.id === nodeId);
    if (!n || !!n.hinge === on) return;
    this.commit();
    const nodes = this.st.s.nodes.map((x) => (x.id !== nodeId ? x : on ? { id: x.id, hinge: true } : { id: x.id }));
    // Шарнир и скользящая заделка в одной точке не совмещаются: шарнир заменяет заделку и наоборот.
    this.set({ s: { ...this.st.s, nodes } });
  };

  /** Соединение частей скользящей заделкой в точке: угол нормали к направляющей или null — убрать. */
  setSlideJoint = (nodeId: string, angle: number | null) => {
    const n = this.st.s.nodes.find((x) => x.id === nodeId);
    if (!n || (n.slide ?? null) === angle) return;
    this.commit();
    const nodes = this.st.s.nodes.map((x) => (x.id !== nodeId ? x : angle == null ? { id: x.id } : { id: x.id, slide: angle }));
    this.set({ s: { ...this.st.s, nodes } });
  };

  /* ---------- отдельные тела и связи между ними ---------- */
  /** Новое тело от точки from со смещением (dx, dy); при нулевом смещении сразу ставится касание. */
  addBody = (from: string, dx: number, dy: number) => this.applyEdit(addBody(this.st.s, from, dx, dy, this.ids));
  removeBody = (root: string) => this.applyEdit(removeBody(this.st.s, root));
  /** Смещение тела из поля: правки поля — одна запись истории. */
  typeBodyPlace = (root: string, dx: number, dy: number) => {
    const r = setBodyPlace(this.st.s, root, dx, dy);
    if (!r.ok) return;
    this.touch('place:' + root);
    this.set({ s: r.s });
  };
  addLink = (type: Link['type']) => this.applyEdit(addLink(this.st.s, type, this.ids));
  removeLink = (id: string) => this.applyEdit(removeLink(this.st.s, id));
  /** Точки, блоки связи (выпадающие списки) — отдельная запись истории. */
  setLink = (id: string, patch: Partial<Link>) => this.applyEdit(patchLink(this.st.s, id, patch));
  /** Числовое поле связи (угол нормали, коэффициент трения): правки поля — одна запись истории. */
  typeLinkField = (id: string, patch: Partial<Link>) => {
    const r = patchLink(this.st.s, id, patch);
    if (!r.ok) return;
    this.touch('link:' + id + ':' + Object.keys(patch).join());
    this.set({ s: r.s });
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
  /** Каток с реакцией под заданным углом (например, перпендикулярно наклонному участку). */
  setRollerAngle = (id: string, angle: number) => {
    const it = this.st.s.items.find((i) => i.id === id);
    if (!it || (it.type !== 'roller' && it.type !== 'rough') || (it.side === 'tilt' && Math.abs((it.angle ?? 0) - angle) < 1e-9)) return;
    this.commit();
    this.patchItem(id, { side: 'tilt', angle } as Partial<Item>);
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

  /* ---------- поиск положения равновесия ---------- */
  /** Включить поиск (параметр — угол от 0 до 90°, без формул) или выключить. */
  setSearchOn = (on: boolean) => {
    if (!!this.st.s.search === on) return;
    this.commit();
    const { search: _, ...rest } = this.st.s;
    this.set({ s: on ? { ...rest, search: { name: 'φ', unit: 'deg', min: 0, max: 90, bind: [] } } : rest, pick: -1 });
  };
  private patchSearch(patch: Partial<Search>) {
    if (!this.st.s.search) return;
    this.set({ s: { ...this.st.s, search: { ...this.st.s.search, ...patch } }, pick: -1 });
  }
  /** Поле поиска (обозначение, границы промежутка): правки поля — одна запись истории. */
  typeSearch = (patch: Partial<Search>) => {
    this.touch('search:' + Object.keys(patch).join());
    this.patchSearch(patch);
  };
  /** Единица параметра (список) — отдельная запись истории. */
  setSearch = (patch: Partial<Search>) => {
    this.commit();
    this.patchSearch(patch);
  };
  /** Добавить формулу: первое поле, ещё не заданное формулой. */
  addBind = () => {
    const sr = this.st.s.search;
    if (!sr) return;
    const free = searchFields(this.st.s).find((f) => !sr.bind.some((b) => b.ref === f.ref && b.field === f.field));
    if (!free) return this.flash('Все поля уже заданы формулами.');
    this.commit();
    this.patchSearch({ bind: [...sr.bind, { ref: free.ref, field: free.field, expr: sr.name }] });
  };
  /** Поле формулы выбрано из списка — отдельная запись истории; текст формулы — одна запись на правку поля. */
  setBind = (i: number, patch: Partial<SearchBind>, typing = false) => {
    const sr = this.st.s.search;
    if (!sr || !sr.bind[i]) return;
    if (typing) this.touch('bind:' + i);
    else this.commit();
    this.patchSearch({ bind: sr.bind.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  };
  removeBind = (i: number) => {
    const sr = this.st.s.search;
    if (!sr) return;
    this.commit();
    this.patchSearch({ bind: sr.bind.filter((_, j) => j !== i) });
  };
  /** Какой корень показать на чертеже и в решении. */
  setPick = (pick: number) => this.set({ pick });

  /* ---------- мастер ---------- */
  setStep = (n: number) => this.set({ wiz: { on: true, step: clamp(n, 1, WSTEPS) } });
  stopWiz = () => this.set({ wiz: { on: false, step: this.st.wiz.step } });
}
