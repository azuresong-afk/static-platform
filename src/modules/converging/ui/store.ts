/** Состояние вкладки «Сходящиеся силы»: узел или приведение системы сил, история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { NodeForce, ReduceProblem, V3 } from '../model/forces';
import { CONV_PRESETS, type ConvPresetKey, type ConvProblem } from '../presets';
import { extraProblem, findAsk, parseExtra, type ExtraProblem } from '../../../shared/extra';
import { CONV_ASKS } from '../model/extra';
import { CONV_EXTRA_PRESETS, type ConvExtraKey } from '../extraPresets';

export const CONV_MODULE = 'converging';
const MAX_ITEMS = 12;
const KINDS: NodeForce['kind'][] = ['known', 'rope', 'rod', 'normal'];

export interface ConvState {
  problem: ConvProblem;
  /** Экран задач пункта 26: система тел на шарнирах, трение, механизмы. */
  extra: ExtraProblem;
  view: 'main' | 'extra';
  title: string;
  preset: ConvPresetKey | ConvExtraKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: ConvProblem;
  extra: ExtraProblem;
  view: 'main' | 'extra';
  title: string;
  preset: ConvState['preset'];
}
const copy = (p: ConvProblem): ConvProblem => structuredClone(p);
const isV3 = (x: unknown): x is V3 => Array.isArray(x) && x.length === 3 && x.every(isNum);

export const newNodeForce = (n: number): NodeForce => ({ name: `S_${n}`, kind: 'rod', F: 0, dirMode: 'ang', v: [1, 0, 0], ang: 0 });
const defaultProblem = (mode: ConvProblem['mode']): ConvProblem =>
  mode === 'node'
    ? { mode, node: { forces: [{ name: 'G', kind: 'known', F: 10, dirMode: 'ang', v: [0, 0, -1], ang: 270 }, { ...newNodeForce(1), kind: 'rope', ang: 45 }, { ...newNodeForce(2), kind: 'rope', ang: 135 }] } }
    : { mode, reduce: { forces: [{ name: 'F_1', r: [0, 0, 0], F: [1, 0, 0] }], pairs: [], O: [0, 0, 0] } };

export function parseConv(raw: unknown): { ok: true; problem: ConvProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw) || (raw.mode !== 'node' && raw.mode !== 'reduce')) return { ok: false, errors: ['В файле нет задачи (problem с полем mode).'] };
  const e: string[] = [];
  const name = (x: unknown, i: number, what: string) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, 12) : `${what}${i + 1}`);
  if (raw.mode === 'node') {
    const fs = isObj(raw.node) && Array.isArray(raw.node.forces) ? raw.node.forces : null;
    if (!fs) return { ok: false, errors: ['В файле нет списка сил узла.'] };
    const forces: NodeForce[] = fs.flatMap((q: unknown, i) => {
      if (!isObj(q) || !KINDS.includes(q.kind as NodeForce['kind']) || !isNum(q.F) || !isNum(q.ang) || !isV3(q.v) || (q.dirMode !== 'vec' && q.dirMode !== 'ang')) return (e.push(`Сила №${i + 1}: неполные данные.`), []);
      return [{ name: name(q.name, i, 'F_'), kind: q.kind as NodeForce['kind'], F: q.F, dirMode: q.dirMode, v: q.v, ang: q.ang }];
    });
    if (forces.length < 2 || forces.length > MAX_ITEMS) e.push(`Сил должно быть от 2 до ${MAX_ITEMS}.`);
    return e.length ? { ok: false, errors: e } : { ok: true, problem: { mode: 'node', node: { forces } } };
  }
  const rd = isObj(raw.reduce) ? raw.reduce : null;
  if (!rd || !Array.isArray(rd.forces) || !Array.isArray(rd.pairs) || !isV3(rd.O)) return { ok: false, errors: ['В файле нет системы сил (forces, pairs, O).'] };
  const forces = rd.forces.flatMap((q: unknown, i) => (isObj(q) && isV3(q.r) && isV3(q.F) ? [{ name: name(q.name, i, 'F_'), r: q.r, F: q.F }] : (e.push(`Сила №${i + 1}: нужны точка r и составляющие F.`), [])));
  const pairs = rd.pairs.flatMap((q: unknown, i) => (isObj(q) && isV3(q.M) ? [{ name: name(q.name, i, 'M_'), M: q.M }] : (e.push(`Пара №${i + 1}: нужен вектор момента M.`), [])));
  if (forces.length + pairs.length < 1 || forces.length > MAX_ITEMS || pairs.length > MAX_ITEMS) e.push('Нужна хотя бы одна сила или пара.');
  return e.length ? { ok: false, errors: e } : { ok: true, problem: { mode: 'reduce', reduce: { forces, pairs, O: rd.O } } };
}

export class ConvStore {
  private st: ConvState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: ConvPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm27';
    this.st = { problem: copy(CONV_PRESETS[k].problem as ConvProblem), extra: structuredClone(CONV_EXTRA_PRESETS.x238.problem), view: 'main', title: CONV_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): ConvState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<ConvState>) {
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
  private editNode(fn: (f: NodeForce[]) => void) {
    const p = copy(this.st.problem);
    if (p.mode === 'node') fn(p.node.forces);
    this.set({ problem: p });
  }
  private editReduce(fn: (r: ReduceProblem) => void) {
    const p = copy(this.st.problem);
    if (p.mode === 'reduce') fn(p.reduce);
    this.set({ problem: p });
  }
  loadPreset = (k: ConvPresetKey | ConvExtraKey) => {
    this.commit();
    if (k in CONV_EXTRA_PRESETS) {
      const e = CONV_EXTRA_PRESETS[k as ConvExtraKey];
      return this.set({ extra: structuredClone(e.problem), view: 'extra', title: e.title, preset: k });
    }
    const m = CONV_PRESETS[k as ConvPresetKey];
    this.set({ problem: copy(m.problem as ConvProblem), view: 'main', title: m.title, preset: k });
  };
  /* ---------- задачи пункта 26 ---------- */
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
    this.set({ extra: extraProblem(findAsk(CONV_ASKS, id)) });
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
  setMode = (mode: ConvProblem['mode']) => {
    if (mode === this.st.problem.mode) return;
    this.commit();
    this.set({ problem: defaultProblem(mode) });
  };
  /* ---------- узел ---------- */
  addNodeForce = () => {
    const p = this.st.problem;
    if (p.mode !== 'node' || p.node.forces.length >= MAX_ITEMS) return;
    this.commit();
    this.editNode((fs) => fs.push(newNodeForce(fs.length)));
  };
  removeNodeForce = (i: number) => {
    const p = this.st.problem;
    if (p.mode !== 'node' || p.node.forces.length <= 2) return;
    this.commit();
    this.editNode((fs) => fs.splice(i, 1));
  };
  setForceKind = (i: number, kind: NodeForce['kind']) => {
    this.commit();
    this.editNode((fs) => {
      fs[i].kind = kind;
      if (kind === 'known' && !fs[i].F) fs[i].F = 10;
    });
  };
  setDirMode = (i: number, m: NodeForce['dirMode']) => {
    this.commit();
    this.editNode((fs) => (fs[i].dirMode = m));
  };
  /** key: F, ang, v0, v1, v2. */
  typeNode = (i: number, key: string, val: number) => {
    this.touch(`n:${i}:${key}`);
    this.editNode((fs) => {
      if (key === 'F' || key === 'ang') fs[i][key] = val;
      else fs[i].v[+key.slice(1)] = val;
    });
  };
  typeNodeName = (i: number, name: string) => {
    this.touch(`n:${i}:name`);
    this.editNode((fs) => (fs[i].name = name.slice(0, 12)));
  };
  /* ---------- приведение ---------- */
  addSysForce = () => {
    const p = this.st.problem;
    if (p.mode !== 'reduce' || p.reduce.forces.length >= MAX_ITEMS) return;
    this.commit();
    this.editReduce((r) => r.forces.push({ name: `F_${r.forces.length + 1}`, r: [0, 0, 0], F: [1, 0, 0] }));
  };
  removeSysForce = (i: number) => {
    this.commit();
    this.editReduce((r) => r.forces.splice(i, 1));
  };
  addPair = () => {
    const p = this.st.problem;
    if (p.mode !== 'reduce' || p.reduce.pairs.length >= MAX_ITEMS) return;
    this.commit();
    this.editReduce((r) => r.pairs.push({ name: `M_${r.pairs.length + 1}`, M: [0, 0, 1] }));
  };
  removePair = (i: number) => {
    this.commit();
    this.editReduce((r) => r.pairs.splice(i, 1));
  };
  /** what: r, F (сила i), M (пара i), O (центр); a — номер оси. */
  typeReduce = (what: 'r' | 'F' | 'M' | 'O', i: number, a: number, val: number) => {
    this.touch(`r:${what}:${i}:${a}`);
    this.editReduce((r) => {
      if (what === 'O') r.O[a] = val;
      else if (what === 'M') r.pairs[i].M[a] = val;
      else r.forces[i][what][a] = val;
    });
  };
  typeReduceName = (what: 'F' | 'M', i: number, name: string) => {
    this.touch(`r:name:${what}:${i}`);
    this.editReduce((r) => ((what === 'F' ? r.forces[i] : r.pairs[i]).name = name.slice(0, 12)));
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
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(CONV_MODULE, this.st.title, { problem: this.st.problem, extra: this.st.extra, view: this.st.view }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== CONV_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseConv(env.raw.problem);
    const ex = parseExtra(env.raw.extra, CONV_ASKS);
    const view = env.raw.view === 'extra' && ex ? 'extra' : 'main';
    if (!r.ok && view !== 'extra') return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Сходящиеся силы';
    this.set({ problem: r.ok ? r.problem : this.st.problem, extra: ex ?? this.st.extra, view, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
