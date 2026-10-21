/** Состояние вкладки «Графическая статика»: задача трёх видов (ферма, балка, цепь), история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { Truss } from '../../truss/model/truss';
import { parseTruss } from '../../truss/ui/store';
import type { BeamLoad, ChainInput, FunicularInput } from '../model/funicular';
import { GRAPH_PRESETS, type GraphPresetKey } from '../presets';

export const GRAPHSTAT_MODULE = 'graphstat';
export type GraphKind = 'truss' | 'beam' | 'chain';
const MAX_LOADS = 12;

export interface GraphState {
  preset: GraphPresetKey | 'custom';
  kind: GraphKind;
  truss: Truss;
  beam: FunicularInput;
  chain: ChainInput;
  title: string;
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}

interface Snap {
  preset: GraphState['preset'];
  kind: GraphKind;
  truss: Truss;
  beam: FunicularInput;
  chain: ChainInput;
  title: string;
}

const copy = <T>(x: T): T => structuredClone(x);
const DEFAULT_TRUSS = GRAPH_PRESETS.m57.truss as Truss;
const DEFAULT_BEAM = GRAPH_PRESETS.m51.beam;
const DEFAULT_CHAIN = GRAPH_PRESETS.m516.chain;

function parseBeam(raw: unknown): FunicularInput | null {
  if (!isObj(raw) || !isNum(raw.xA) || !isNum(raw.xB) || !isNum(raw.angleB) || !Array.isArray(raw.loads)) return null;
  const loads: BeamLoad[] = [];
  for (const l of raw.loads) {
    if (!isObj(l) || !isNum(l.x) || !isNum(l.F) || !isNum(l.angle)) return null;
    loads.push({ x: l.x, F: l.F, angle: l.angle });
  }
  if (loads.length > MAX_LOADS) return null;
  return { xA: raw.xA, xB: raw.xB, angleB: raw.angleB, loads, pole: isNum(raw.pole) && raw.pole > 0 ? raw.pole : undefined };
}
function parseChain(raw: unknown): ChainInput | null {
  if (!isObj(raw) || !isNum(raw.L) || !isNum(raw.f) || !isNum(raw.q) || !isNum(raw.chains) || !isNum(raw.n)) return null;
  return { L: raw.L, f: raw.f, q: raw.q, chains: raw.chains, n: raw.n };
}

export class GraphStore {
  private st: GraphState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();

  constructor(opts: { preset?: GraphPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm57';
    this.st = { ...this.fromPreset(k), canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  private fromPreset(k: GraphPresetKey) {
    const p = GRAPH_PRESETS[k];
    return {
      preset: k,
      kind: p.kind,
      truss: copy(p.kind === 'truss' ? (p.truss as Truss) : DEFAULT_TRUSS),
      beam: copy(p.kind === 'beam' ? p.beam : DEFAULT_BEAM),
      chain: copy(p.kind === 'chain' ? p.chain : DEFAULT_CHAIN),
      title: p.title,
    };
  }

  get = (): GraphState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<GraphState>) {
    this.st = { ...this.st, ...patch, canUndo: this.hist.canUndo, canRedo: this.hist.canRedo };
    this.listeners.forEach((f) => f());
  }
  private snap = (): Snap => ({
    preset: this.st.preset,
    kind: this.st.kind,
    truss: this.st.truss,
    beam: this.st.beam,
    chain: this.st.chain,
    title: this.st.title,
  });
  private commit() {
    this.hist.push(this.snap());
    if (this.st.preset !== 'custom') this.st = { ...this.st, preset: 'custom', title: 'Своя задача' };
  }
  private touch(key: string) {
    if (this.hist.startSession(key)) this.commit();
  }
  endSession = (key: string) => this.hist.endSession(key);

  loadPreset = (k: GraphPresetKey) => {
    this.hist.push(this.snap());
    this.set(this.fromPreset(k));
  };

  /* ферма: координаты узлов и нагрузки */
  typeNode = (i: number, key: 'x' | 'y', x: number) => {
    this.touch(`node:${i}:${key}`);
    const t = copy(this.st.truss);
    t.nodes[i][key] = x;
    this.set({ truss: t });
  };
  typeLoad = (j: number, key: 'F' | 'angle', x: number) => {
    this.touch(`load:${j}:${key}`);
    const t = copy(this.st.truss);
    t.loads[j][key] = x;
    this.set({ truss: t });
  };
  setLoadNode = (j: number, node: number) => {
    this.commit();
    const t = copy(this.st.truss);
    t.loads[j].node = node;
    this.set({ truss: t });
  };
  addLoad = () => {
    this.commit();
    const t = copy(this.st.truss);
    t.loads.push({ node: Math.min(2, t.nodes.length - 1), F: 1, angle: 270 });
    this.set({ truss: t });
  };
  removeLoad = (j: number) => {
    this.commit();
    const t = copy(this.st.truss);
    t.loads.splice(j, 1);
    this.set({ truss: t });
  };

  /* балка */
  typeBeam = (key: 'xA' | 'xB' | 'angleB' | 'pole', x: number) => {
    this.touch(`beam:${key}`);
    this.set({ beam: { ...this.st.beam, [key]: x } });
  };
  typeBeamLoad = (j: number, key: keyof BeamLoad, x: number) => {
    this.touch(`bl:${j}:${key}`);
    const bm = copy(this.st.beam);
    bm.loads[j][key] = x;
    this.set({ beam: bm });
  };
  addBeamLoad = () => {
    if (this.st.beam.loads.length >= MAX_LOADS) return;
    this.commit();
    const bm = copy(this.st.beam);
    bm.loads.push({ x: (bm.xA + bm.xB) / 2, F: 1, angle: 270 });
    this.set({ beam: bm });
  };
  removeBeamLoad = (j: number) => {
    this.commit();
    const bm = copy(this.st.beam);
    bm.loads.splice(j, 1);
    this.set({ beam: bm });
  };

  /* цепь */
  typeChain = (key: keyof ChainInput, x: number) => {
    this.touch(`chain:${key}`);
    this.set({ chain: { ...this.st.chain, [key]: x } });
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
    text: writeEnvelope(GRAPHSTAT_MODULE, this.st.title, { kind: this.st.kind, truss: this.st.truss, beam: this.st.beam, chain: this.st.chain }, now),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== GRAPHSTAT_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const kind = env.raw.kind;
    if (kind !== 'truss' && kind !== 'beam' && kind !== 'chain')
      return (this.notify(head + 'не указан вид задачи (kind: truss, beam или chain).', 'bad'), false);
    const tr = parseTruss(env.raw.truss);
    const bm = parseBeam(env.raw.beam);
    const ch = parseChain(env.raw.chain);
    if (kind === 'truss' && !tr.ok) return (this.notify(head + tr.errors.slice(0, 3).join(' '), 'bad'), false);
    if (kind === 'beam' && !bm) return (this.notify(head + 'в файле нет данных балки (beam: xA, xB, angleB, loads).', 'bad'), false);
    if (kind === 'chain' && !ch) return (this.notify(head + 'в файле нет данных цепи (chain: L, f, q, chains, n).', 'bad'), false);
    this.hist.push(this.snap());
    const title = env.title ?? 'Графическая статика';
    this.set({
      preset: 'custom',
      kind,
      truss: tr.ok ? tr.truss : copy(DEFAULT_TRUSS),
      beam: bm ?? copy(DEFAULT_BEAM),
      chain: ch ?? copy(DEFAULT_CHAIN),
      title,
    });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
