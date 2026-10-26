/** Состояние вкладки «Колебания систем»: задача, история отмены, файл проекта. */
import type { ExtraProblem } from '../../../shared/extra';
import { extraHost, readExtraView, type XView } from '../../../shared/extraHost';
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { BeamMass, BeamSupport, BeamSys } from '../model/beam';
import { MAX_DOF, type AbsorberSys, type ChainBody, type ChainLink, type ChainSys, type EnergySys, type VibCoord, type VibProblem } from '../model/vibration';
import { VIB_ASKS } from '../model/extra';
import { VIB_EXTRA_PRESETS, type VibExtraKey } from '../extraPresets';
import { defaultProblem, VIB_PRESETS, type VibPresetKey } from '../presets';

export const VIB_MODULE = 'vibration';
const MAX_PARAMS = 14;
const MAX_SUPPORTS = 6;

export interface VibState {
  problem: VibProblem;
  extra: ExtraProblem;
  view: XView;
  title: string;
  preset: VibPresetKey | VibExtraKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: VibProblem;
  extra: ExtraProblem;
  view: XView;
  title: string;
  preset: VibState['preset'];
}
const copy = <T>(x: T): T => structuredClone(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const nums = (o: Record<string, unknown>, keys: string[]) => keys.every((k) => isNum(o[k]));

function parseEnergy(raw: unknown): EnergySys | null {
  if (!isObj(raw) || !Array.isArray(raw.coords) || !Array.isArray(raw.params) || !isStr(raw.T) || !isStr(raw.P) || !isStr(raw.D)) return null;
  if (!raw.coords.length || raw.coords.length > MAX_DOF || raw.params.length > MAX_PARAMS) return null;
  const coords: VibCoord[] = [];
  for (const c of raw.coords) {
    if (!isObj(c) || !isStr(c.name) || !isStr(c.H) || !nums(c, ['eq', 'q0', 'v0'])) return null;
    coords.push({ name: c.name.slice(0, 20), eq: c.eq as number, q0: c.q0 as number, v0: c.v0 as number, H: c.H.slice(0, 200) });
  }
  const params: EnergySys['params'] = [];
  for (const p of raw.params) {
    if (!isObj(p) || !isStr(p.name) || !isNum(p.value)) return null;
    params.push({ name: p.name.slice(0, 20), value: p.value });
  }
  return { coords, params, T: raw.T.slice(0, 600), P: raw.P.slice(0, 600), D: raw.D.slice(0, 300) };
}
function parseChain(raw: unknown): ChainSys | null {
  if (
    !isObj(raw) ||
    !['spring', 'shaft', 'string'].includes(raw.kind as string) ||
    !['free', 'fixed', 'moving'].includes(raw.left as string) ||
    !['free', 'fixed'].includes(raw.right as string)
  )
    return null;
  if (!nums(raw, ['G', 'N', 'xi0']) || !Array.isArray(raw.bodies) || !Array.isArray(raw.links)) return null;
  const n = raw.bodies.length;
  if (!n || n > MAX_DOF || raw.links.length !== n + 1) return null;
  const bodies: ChainBody[] = [];
  for (const b of raw.bodies) {
    if (!isObj(b) || !nums(b, ['m', 'cg', 'q0', 'v0', 'H'])) return null;
    bodies.push({ m: b.m as number, cg: b.cg as number, q0: b.q0 as number, v0: b.v0 as number, H: b.H as number });
  }
  const links: ChainLink[] = [];
  for (const l of raw.links) {
    if (!isObj(l) || !nums(l, ['c', 'b', 'len', 'd'])) return null;
    links.push({ c: l.c as number, b: l.b as number, len: l.len as number, d: l.d as number });
  }
  return {
    kind: raw.kind as ChainSys['kind'],
    bodies,
    links,
    left: raw.left as ChainSys['left'],
    right: raw.right as ChainSys['right'],
    G: raw.G as number,
    N: raw.N as number,
    xi0: raw.xi0 as number,
  };
}
function parseBeam(raw: unknown): BeamSys | null {
  if (!isObj(raw) || !nums(raw, ['L', 'EJ']) || !Array.isArray(raw.supports) || !Array.isArray(raw.masses)) return null;
  if (raw.supports.length > MAX_SUPPORTS || !raw.masses.length || raw.masses.length > MAX_DOF) return null;
  const supports: BeamSupport[] = [];
  for (const s of raw.supports) {
    if (!isObj(s) || !isNum(s.x) || !['pin', 'fixed'].includes(s.kind as string)) return null;
    supports.push({ x: s.x, kind: s.kind as BeamSupport['kind'] });
  }
  const masses: BeamMass[] = [];
  for (const m of raw.masses) {
    if (!isObj(m) || !nums(m, ['x', 'm', 'J', 'e', 'H'])) return null;
    masses.push({ x: m.x as number, m: m.m as number, J: m.J as number, e: m.e as number, H: m.H as number, ...(isNum(m.h) && m.h > 0 ? { h: m.h } : {}) });
  }
  return { L: raw.L as number, EJ: raw.EJ as number, supports, masses };
}
function parseAbsorber(raw: unknown): AbsorberSys | null {
  if (!isObj(raw) || !nums(raw, ['m1', 'c1', 'H', 'A', 'm2']) || typeof raw.c1Res !== 'boolean' || !['amp', 'mass'].includes(raw.by as string)) return null;
  return {
    m1: raw.m1 as number,
    c1: raw.c1 as number,
    c1Res: raw.c1Res,
    H: raw.H as number,
    by: raw.by as AbsorberSys['by'],
    A: raw.A as number,
    m2: raw.m2 as number,
  };
}

export function parseVib(raw: unknown): { ok: true; problem: VibProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !['energy', 'chain', 'beam', 'absorber'].includes(raw.src as string))
    return { ok: false, errors: ['В файле нет задачи (problem с полем src).'] };
  const f = raw.force;
  if (!isObj(f) || !['none', 'harm', 'const'].includes(f.kind as string) || !isNum(f.p) || !isNum(raw.tEnd) || raw.tEnd < 0)
    return { ok: false, errors: ['Возмущающая сила (force) или время интегрирования заданы неверно.'] };
  const def = defaultProblem();
  const e = parseEnergy(raw.energy),
    c = parseChain(raw.chain),
    b = parseBeam(raw.beam),
    a = parseAbsorber(raw.absorber);
  const src = raw.src as VibProblem['src'];
  if (!{ energy: e, chain: c, beam: b, absorber: a }[src]) return { ok: false, errors: ['Данные системы неполные или неверные.'] };
  return {
    ok: true,
    problem: {
      src,
      energy: e ?? def.energy,
      chain: c ?? def.chain,
      beam: b ?? def.beam,
      absorber: a ?? def.absorber,
      force: {
        kind: f.kind as VibProblem['force']['kind'],
        p: f.p as number,
        ...(f.cos === true ? { cos: true } : {}),
        ...(isNum(f.dst) && f.dst !== 0 ? { dst: f.dst } : {}),
      },
      tEnd: raw.tEnd as number,
    },
  };
}

export class VibStore {
  private st: VibState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: VibPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm5445';
    this.st = {
      problem: copy(VIB_PRESETS[k].problem),
      extra: structuredClone(VIB_EXTRA_PRESETS.x5410.problem),
      view: 'main',
      title: VIB_PRESETS[k].title,
      preset: k,
      canUndo: false,
      canRedo: false,
      notice: null,
      explain: opts.explain ?? true,
    };
  }
  get = (): VibState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<VibState>) {
    this.st = { ...this.st, ...patch, canUndo: this.hist.canUndo, canRedo: this.hist.canRedo };
    this.listeners.forEach((f) => f());
  }
  private snap = (): Snap => ({ problem: this.st.problem, extra: this.st.extra, view: this.st.view, title: this.st.title, preset: this.st.preset });
  private commit() {
    this.hist.push(this.snap());
    if (this.st.preset !== 'custom') this.st = { ...this.st, preset: 'custom', title: 'Своя система' };
  }
  private apply(fn: (p: VibProblem) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  /** Ввод в поле: правки одного поля подряд — одна запись истории. */
  type = (key: string, fn: (p: VibProblem) => void) => {
    if (this.hist.startSession(key)) this.commit();
    this.apply(fn);
  };
  endSession = (key: string) => this.hist.endSession(key);
  /** Однократное действие (выбор, добавление, удаление). */
  act = (fn: (p: VibProblem) => void) => {
    this.commit();
    this.apply(fn);
  };
  loadPreset = (k: VibPresetKey | VibExtraKey) => {
    this.commit();
    if (k in VIB_EXTRA_PRESETS) {
      const e = VIB_EXTRA_PRESETS[k as VibExtraKey];
      return this.set({ extra: structuredClone(e.problem), view: 'extra', title: e.title, preset: k });
    }
    const m = k as VibPresetKey;
    this.set({ problem: copy(VIB_PRESETS[m].problem), view: 'main', title: VIB_PRESETS[m].title, preset: k });
  };
  private touch(key: string) {
    if (this.hist.startSession(key)) this.commit();
  }
  /** Второй экран (пункт 30): задачи §54 в буквах и приближённые формулы. */
  xhost = extraHost(VIB_ASKS, this, { commit: () => this.commit(), touch: (k) => this.touch(k), patch: (p) => this.set(p) });
  /* Добавление и удаление строк. */
  addCoord = () =>
    this.act((p) => {
      const e = p.energy;
      if (e.coords.length >= MAX_DOF) return;
      const used = new Set([...e.coords.map((c) => c.name), ...e.params.map((c) => c.name)]);
      const name = ['x', 'y', 'z', 'φ', 'ψ', 'θ', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6'].find((x) => !used.has(x)) ?? 'q' + (e.coords.length + 1);
      e.coords.push({ name, eq: 0, q0: 0, v0: 0, H: '' });
    });
  removeCoord = (i: number) => this.act((p) => p.energy.coords.length > 1 && p.energy.coords.splice(i, 1));
  addParam = () =>
    this.act((p) => {
      const e = p.energy;
      if (e.params.length >= MAX_PARAMS) return;
      const used = new Set([...e.coords.map((c) => c.name), ...e.params.map((c) => c.name)]);
      const name = ['m', 'c', 'l', 'g', 'a', 'b', 'J', 'k', 'h', 'P', 'Q', 'F', 'r', 'R'].find((x) => !used.has(x)) ?? 'p' + (e.params.length + 1);
      e.params.push({ name, value: 1 });
    });
  removeParam = (i: number) => this.act((p) => p.energy.params.splice(i, 1));
  addBody = () =>
    this.act((p) => {
      const c = p.chain;
      if (c.bodies.length >= MAX_DOF) return;
      const last = c.bodies[c.bodies.length - 1];
      c.bodies.push({ ...last, q0: 0, v0: 0, H: 0 });
      const mid = c.links[c.links.length - 2] ?? c.links[0];
      c.links.splice(c.links.length - 1, 0, { ...mid });
    });
  removeBody = (i: number) =>
    this.act((p) => {
      const c = p.chain;
      if (c.bodies.length <= 1) return;
      c.bodies.splice(i, 1);
      // Тело i убрано: его левое и правое звенья заменяются одним (правым, у последнего — левым).
      c.links.splice(i === c.bodies.length ? i : i + 1, 1);
    });
  addSupport = () => this.act((p) => p.beam.supports.length < MAX_SUPPORTS && p.beam.supports.push({ x: p.beam.L, kind: 'pin' }));
  removeSupport = (i: number) => this.act((p) => p.beam.supports.splice(i, 1));
  addMass = () =>
    this.act((p) => {
      const b = p.beam;
      if (b.masses.length >= MAX_DOF) return;
      b.masses.push({ x: b.L / 2, m: 1, J: 0, e: 0, H: 0 });
    });
  removeMass = (i: number) => this.act((p) => p.beam.masses.length > 1 && p.beam.masses.splice(i, 1));
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
  exportProject = (now = new Date()) => ({
    name: projectFileName(this.st.title, now),
    text: writeEnvelope(VIB_MODULE, this.st.title, { problem: this.st.problem, extra: this.st.extra, view: this.st.view }, now),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== VIB_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseVib(env.raw.problem);
    const x = readExtraView(env.raw, VIB_ASKS, r.ok);
    if (!x.usable) return (this.notify(head + (r.ok ? '' : r.errors.slice(0, 4).join(' ')), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Колебания систем';
    this.set({ problem: r.ok ? r.problem : this.st.problem, extra: x.extra ?? this.st.extra, view: x.view, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
