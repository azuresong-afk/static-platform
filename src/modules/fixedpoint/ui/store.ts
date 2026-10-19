/** Состояние вкладки «Тело с неподвижной точкой»: схема, углы Эйлера, винт; история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { Ax, EulerProblem, Seq } from '../model/euler';
import {
  LIMITS,
  type InputKind,
  type LenUnit,
  type PointKind,
  type RateUnit,
  type SBody,
  type SchemeProblem,
  type SContact,
  type SInput,
  type SPoint,
} from '../model/scheme';
import { SCREW_LIMITS, type ScrewItem, type ScrewPoint, type ScrewProblem } from '../model/screw';
import { euler, FP_PRESETS, screw, type FpMode, type FpPresetKey, type FpState } from '../presets';

export const FIXEDPOINT_MODULE = 'fixedpoint';
const UNITS: LenUnit[] = ['m', 'cm', 'mm'];
const PKINDS: PointKind[] = ['xy', 'polar', 'axis', 'cross'];
const IKINDS: InputKind[] = ['rel', 'speed', 'acc'];
const RUNITS: RateUnit[] = ['rad', 'rpm', 'period'];
const SEQS: Seq[] = ['zxz', 'zyz', 'plane', 'ship', 'cardan1', 'cardan2', 'custom'];
const AXES: Ax[] = [1, 2, 3];
export const EULER_NUM = ['t1', 'mx', 'my', 'mz'] as const;
export type EulerNumKey = (typeof EULER_NUM)[number];
export type EulerLawKey = 'q1' | 'q2' | 'q3';

export interface FpStoreState {
  problem: FpState;
  title: string;
  preset: FpPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: FpState;
  title: string;
  preset: FpStoreState['preset'];
}
const copy = <T>(p: T): T => structuredClone(p);
const DEF: FpState = {
  mode: 'scheme',
  scheme: copy((FP_PRESETS.m195.problem as { scheme: SchemeProblem }).scheme),
  euler: euler({ seq: 'zxz', q1: '0,5t', q2: 'π/6', q3: '3t', t1: 1, mx: 0, my: 10, mz: 0 }),
  screw: screw({ items: [{ kind: 'rot', x: 0, y: 0, z: 2, px: 0, py: 0, pz: 0 }], points: [{ name: 'M', x: 1, y: 0, z: 0 }] }),
};

export function presetState(k: FpPresetKey, base: FpState = DEF): FpState {
  const t = FP_PRESETS[k].problem;
  const s = copy(base);
  s.mode = t.mode;
  if (t.mode === 'scheme') s.scheme = copy(t.scheme);
  else if (t.mode === 'euler') s.euler = copy(t.euler);
  else s.screw = copy(t.screw);
  return s;
}

/* ---------- разбор файла ---------- */

const str = (v: unknown, max = 24) => (typeof v === 'string' ? v.slice(0, max) : null);
const int = (v: unknown) => (isNum(v) && Number.isInteger(v) && v >= 0 ? v : null);
function parseScheme(raw: unknown): SchemeProblem | null {
  if (!isObj(raw) || !UNITS.includes(raw.unit as LenUnit)) return null;
  const arr = (v: unknown, max: number) => (Array.isArray(v) && v.length <= max ? v : null);
  const bodies = arr(raw.bodies, LIMITS.bodies),
    points = arr(raw.points, LIMITS.points),
    contacts = arr(raw.contacts, LIMITS.contacts),
    inputs = arr(raw.inputs, LIMITS.inputs);
  if (!bodies || !points || !contacts || !inputs) return null;
  const B: SBody[] = [];
  for (const b of bodies) {
    if (!isObj(b)) return null;
    const id = int(b.id),
      parent = int(b.parent),
      name = str(b.name);
    if (!id || parent === null || name === null || ![b.x, b.y, b.ang].every(isNum)) return null;
    B.push({ id, name, parent, x: b.x as number, y: b.y as number, ang: b.ang as number });
  }
  const P: SPoint[] = [];
  for (const p of points) {
    if (!isObj(p)) return null;
    const id = int(p.id),
      name = str(p.name),
      b1 = int(p.b1),
      b2 = int(p.b2),
      body = int(p.body);
    if (!id || name === null || b1 === null || b2 === null || body === null || !PKINDS.includes(p.k as PointKind) || ![p.u, p.v, p.z].every(isNum)) return null;
    P.push({ id, name, k: p.k as PointKind, u: p.u as number, v: p.v as number, b1, b2, z: p.z as number, body });
  }
  const C: SContact[] = [];
  for (const c of contacts) {
    if (!isObj(c)) return null;
    const a = int(c.a),
      b = int(c.b),
      p = int(c.p);
    if (a === null || b === null || p === null) return null;
    C.push({ a, b, p });
  }
  const I: SInput[] = [];
  for (const i of inputs) {
    if (!isObj(i)) return null;
    const body = int(i.body),
      p = int(i.p);
    if (body === null || p === null || !IKINDS.includes(i.kind as InputKind) || !RUNITS.includes(i.unit as RateUnit) || !isNum(i.val) || !isNum(i.d))
      return null;
    I.push({ kind: i.kind as InputKind, body, p, val: i.val, unit: i.unit as RateUnit, d: i.d });
  }
  return { unit: raw.unit as LenUnit, bodies: B, points: P, contacts: C, inputs: I };
}
function parseEuler(raw: unknown): EulerProblem | null {
  if (!isObj(raw) || !SEQS.includes(raw.seq as Seq) || !EULER_NUM.every((k) => isNum(raw[k])) || !UNITS.includes(raw.unit as LenUnit)) return null;
  if (![raw.a1, raw.a2, raw.a3].every((a) => AXES.includes(a as Ax))) return null;
  const law = (v: unknown) => (typeof v === 'string' ? v.slice(0, 120) : null);
  const q1 = law(raw.q1),
    q2 = law(raw.q2),
    q3 = law(raw.q3);
  if (q1 === null || q2 === null || q3 === null) return null;
  return {
    seq: raw.seq as Seq,
    a1: raw.a1 as Ax,
    a2: raw.a2 as Ax,
    a3: raw.a3 as Ax,
    q1,
    q2,
    q3,
    t1: raw.t1 as number,
    mx: raw.mx as number,
    my: raw.my as number,
    mz: raw.mz as number,
    unit: raw.unit as LenUnit,
  };
}
function parseScrew(raw: unknown): ScrewProblem | null {
  if (!isObj(raw) || !UNITS.includes(raw.unit as LenUnit) || !Array.isArray(raw.items) || !Array.isArray(raw.points)) return null;
  if (raw.items.length > SCREW_LIMITS.items || raw.points.length > SCREW_LIMITS.points) return null;
  const items: ScrewItem[] = [];
  for (const it of raw.items) {
    if (!isObj(it) || !['rot', 'tr'].includes(it.kind as string) || ![it.x, it.y, it.z, it.px, it.py, it.pz].every(isNum)) return null;
    items.push({
      kind: it.kind as ScrewItem['kind'],
      x: it.x as number,
      y: it.y as number,
      z: it.z as number,
      px: it.px as number,
      py: it.py as number,
      pz: it.pz as number,
    });
  }
  const points: ScrewPoint[] = [];
  for (const p of raw.points) {
    const name = isObj(p) ? str(p.name) : null;
    if (!isObj(p) || name === null || ![p.x, p.y, p.z].every(isNum)) return null;
    points.push({ name, x: p.x as number, y: p.y as number, z: p.z as number });
  }
  return { unit: raw.unit as LenUnit, items, points };
}

export function parseFp(raw: unknown): { ok: true; problem: FpState } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !['scheme', 'euler', 'screw'].includes(raw.mode as string)) return { ok: false, errors: ['В файле нет задачи (problem с полем mode).'] };
  const s = parseScheme(raw.scheme),
    e = parseEuler(raw.euler),
    w = parseScrew(raw.screw);
  const cur = raw.mode === 'scheme' ? s : raw.mode === 'euler' ? e : w;
  if (!cur) return { ok: false, errors: ['Данные задачи неполные.'] };
  return { ok: true, problem: { mode: raw.mode as FpMode, scheme: s ?? copy(DEF.scheme), euler: e ?? copy(DEF.euler), screw: w ?? copy(DEF.screw) } };
}

const nextId = (xs: { id: number }[]) => xs.reduce((m, x) => Math.max(m, x.id), 0) + 1;

export class FpStore {
  private st: FpStoreState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: FpPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm195';
    this.st = { problem: presetState(k), title: FP_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): FpStoreState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<FpStoreState>) {
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
  private edit(fn: (p: FpState) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  private change(fn: (p: FpState) => void) {
    this.commit();
    this.edit(fn);
  }
  loadPreset = (k: FpPresetKey) => {
    this.commit();
    this.set({ problem: presetState(k, this.st.problem), title: FP_PRESETS[k].title, preset: k });
  };
  setMode = (m: FpMode) => {
    if (m !== this.st.problem.mode) this.change((p) => (p.mode = m));
  };
  /* ---------- схема ---------- */
  setUnit = (u: LenUnit) => this.change((p) => (p.scheme.unit = u));
  addBody = () =>
    this.change((p) => {
      const s = p.scheme;
      if (s.bodies.length >= LIMITS.bodies) return;
      const id = nextId(s.bodies);
      s.bodies.push({ id, name: String(id), parent: 0, x: 0, y: 0, ang: 90 });
    });
  removeBody = (id: number) =>
    this.change((p) => {
      const s = p.scheme;
      const gone = s.bodies.find((b) => b.id === id);
      if (!gone) return;
      s.bodies = s.bodies.filter((b) => b.id !== id);
      for (const b of s.bodies) if (b.parent === id) b.parent = gone.parent;
      for (const q of s.points) {
        if (q.b1 === id) q.b1 = 0;
        if (q.b2 === id) q.b2 = 0;
        if (q.body === id) q.body = 0;
      }
      s.contacts = s.contacts.filter((c) => c.a !== id && c.b !== id);
      s.inputs = s.inputs.filter((i) => i.body !== id);
    });
  typeBody = (id: number, key: 'x' | 'y' | 'ang', v: number) => {
    this.touch(`b:${id}:${key}`);
    this.edit((p) => {
      const b = p.scheme.bodies.find((x) => x.id === id);
      if (b) b[key] = v;
    });
  };
  nameBody = (id: number, name: string) => {
    this.touch(`b:${id}:name`);
    this.edit((p) => {
      const b = p.scheme.bodies.find((x) => x.id === id);
      if (b) b.name = name.slice(0, 24);
    });
  };
  setParent = (id: number, parent: number) =>
    this.change((p) => {
      const b = p.scheme.bodies.find((x) => x.id === id);
      if (b && parent !== id) b.parent = parent;
    });
  addPoint = () =>
    this.change((p) => {
      const s = p.scheme;
      if (s.points.length >= LIMITS.points) return;
      const id = nextId(s.points);
      s.points.push({ id, name: `P${id}`, k: 'xy', u: 0, v: 0, b1: 0, b2: 0, z: 0, body: 0 });
    });
  removePoint = (id: number) =>
    this.change((p) => {
      const s = p.scheme;
      s.points = s.points.filter((q) => q.id !== id);
      s.contacts = s.contacts.filter((c) => c.p !== id);
      for (const i of s.inputs) if (i.p === id) i.p = 0;
    });
  typePoint = (id: number, key: 'u' | 'v' | 'z', v: number) => {
    this.touch(`p:${id}:${key}`);
    this.edit((p) => {
      const q = p.scheme.points.find((x) => x.id === id);
      if (q) q[key] = v;
    });
  };
  namePoint = (id: number, name: string) => {
    this.touch(`p:${id}:name`);
    this.edit((p) => {
      const q = p.scheme.points.find((x) => x.id === id);
      if (q) q.name = name.slice(0, 24);
    });
  };
  setPoint = <K extends 'k' | 'b1' | 'b2' | 'body'>(id: number, key: K, v: SPoint[K]) =>
    this.change((p) => {
      const q = p.scheme.points.find((x) => x.id === id);
      if (q) q[key] = v;
    });
  addContact = () =>
    this.change((p) => {
      const s = p.scheme;
      if (s.contacts.length < LIMITS.contacts) s.contacts.push({ a: s.bodies[0]?.id ?? 0, b: 0, p: s.points[0]?.id ?? 0 });
    });
  removeContact = (i: number) => this.change((p) => p.scheme.contacts.splice(i, 1));
  setContact = (i: number, key: keyof SContact, v: number) =>
    this.change((p) => {
      const c = p.scheme.contacts[i];
      if (c) c[key] = v;
    });
  addInput = () =>
    this.change((p) => {
      const s = p.scheme;
      if (s.inputs.length < LIMITS.inputs) s.inputs.push({ kind: 'rel', body: s.bodies[0]?.id ?? 0, p: 0, val: 1, unit: 'rad', d: 0 });
    });
  removeInput = (i: number) => this.change((p) => p.scheme.inputs.splice(i, 1));
  setInput = <K extends 'kind' | 'body' | 'p' | 'unit'>(i: number, key: K, v: SInput[K]) =>
    this.change((p) => {
      const x = p.scheme.inputs[i];
      if (x) x[key] = v;
    });
  typeInput = (i: number, key: 'val' | 'd', v: number) => {
    this.touch(`i:${i}:${key}`);
    this.edit((p) => {
      const x = p.scheme.inputs[i];
      if (x) x[key] = v;
    });
  };
  /* ---------- углы Эйлера ---------- */
  typeEuler = (key: EulerNumKey, v: number) => {
    this.touch(`e:${key}`);
    this.edit((p) => (p.euler[key] = v));
  };
  lawEuler = (key: EulerLawKey, s: string) => {
    this.touch(`e:${key}`);
    this.edit((p) => (p.euler[key] = s.slice(0, 120)));
  };
  setSeq = (s: Seq) => this.change((p) => (p.euler.seq = s));
  setAxis = (key: 'a1' | 'a2' | 'a3', a: Ax) => this.change((p) => (p.euler[key] = a));
  setEulerUnit = (u: LenUnit) => this.change((p) => (p.euler.unit = u));
  /* ---------- винт ---------- */
  setScrewUnit = (u: LenUnit) => this.change((p) => (p.screw.unit = u));
  addItem = (kind: ScrewItem['kind']) =>
    this.change((p) => {
      if (p.screw.items.length < SCREW_LIMITS.items) p.screw.items.push({ kind, x: 0, y: 0, z: 1, px: 0, py: 0, pz: 0 });
    });
  removeItem = (i: number) => this.change((p) => p.screw.items.splice(i, 1));
  typeItem = (i: number, key: 'x' | 'y' | 'z' | 'px' | 'py' | 'pz', v: number) => {
    this.touch(`w:${i}:${key}`);
    this.edit((p) => {
      const it = p.screw.items[i];
      if (it) it[key] = v;
    });
  };
  addScrewPoint = () =>
    this.change((p) => {
      if (p.screw.points.length < SCREW_LIMITS.points) p.screw.points.push({ name: `M${p.screw.points.length + 1}`, x: 0, y: 0, z: 0 });
    });
  removeScrewPoint = (i: number) => this.change((p) => p.screw.points.splice(i, 1));
  typeScrewPoint = (i: number, key: 'x' | 'y' | 'z', v: number) => {
    this.touch(`wp:${i}:${key}`);
    this.edit((p) => {
      const q = p.screw.points[i];
      if (q) q[key] = v;
    });
  };
  nameScrewPoint = (i: number, name: string) => {
    this.touch(`wp:${i}:name`);
    this.edit((p) => {
      const q = p.screw.points[i];
      if (q) q.name = name.slice(0, 24);
    });
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
  exportProject = (now = new Date()) => ({
    name: projectFileName(this.st.title, now),
    text: writeEnvelope(FIXEDPOINT_MODULE, this.st.title, { problem: this.st.problem }, now),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== FIXEDPOINT_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseFp(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Тело с неподвижной точкой';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
