/** Состояние вкладки «Плоский механизм»: точки, звенья, связи, ведущие; что показывать; история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { MBody, MCons, MDrive, MechProblem, MLoad, MMass, MPoint, PtDef } from '../model/mech';
import { MECH_PRESETS, type MechPresetKey } from '../presets';

export const MECH_MODULE = 'mechanism';
export const MAX_ITEMS = 24;

export interface MechState {
  problem: MechProblem;
  title: string;
  preset: MechPresetKey | 'custom';
  show: 'v' | 'a';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: MechProblem;
  title: string;
  preset: MechState['preset'];
}
const copy = (p: MechProblem): MechProblem => structuredClone(p);
type Path = (string | number)[];

/* ---------- разбор файла ---------- */
const str = (o: Record<string, unknown>, k: string, d = '') => (typeof o[k] === 'string' ? (o[k] as string).slice(0, 120) : typeof o[k] === 'number' ? String(o[k]) : d);
const side = (o: Record<string, unknown>) => (o.side === -1 ? -1 : 1) as 1 | -1;

function parseDef(raw: unknown): PtDef | null {
  if (!isObj(raw)) return null;
  switch (raw.k) {
    case 'xy':
      return { k: 'xy', x: str(raw, 'x', '0'), y: str(raw, 'y', '0') };
    case 'polar':
      return { k: 'polar', from: str(raw, 'from'), L: str(raw, 'L', '1'), ang: str(raw, 'ang', '0'), ...(typeof raw.to === 'string' ? { to: str(raw, 'to') } : {}) };
    case 'two':
      return { k: 'two', p1: str(raw, 'p1'), L1: str(raw, 'L1', '1'), p2: str(raw, 'p2'), L2: str(raw, 'L2', '1'), side: side(raw) };
    case 'line':
      return { k: 'line', from: str(raw, 'from'), L: str(raw, 'L', '1'), through: str(raw, 'through'), ang: str(raw, 'ang', '0'), side: side(raw) };
    case 'seg':
      return { k: 'seg', p1: str(raw, 'p1'), p2: str(raw, 'p2'), t: str(raw, 't', '1/2') };
    case 'cross':
      return { k: 'cross', p1: str(raw, 'p1'), q1: str(raw, 'q1'), a1: str(raw, 'a1', '0'), p2: str(raw, 'p2'), q2: str(raw, 'q2'), a2: str(raw, 'a2', '90') };
  }
  return null;
}
function parseCons(raw: unknown): MCons | null {
  if (!isObj(raw)) return null;
  switch (raw.k) {
    case 'fixed':
      return { k: 'fixed', p: str(raw, 'p') };
    case 'slider':
      return { k: 'slider', p: str(raw, 'p'), ang: str(raw, 'ang', '0') };
    case 'roll':
      return { k: 'roll', b: str(raw, 'b'), c: str(raw, 'c'), r: str(raw, 'r', '1'), ang: str(raw, 'ang', '0') };
    case 'gear':
      return { k: 'gear', b1: str(raw, 'b1'), c1: str(raw, 'c1'), r1: str(raw, 'r1', '1'), b2: str(raw, 'b2'), c2: str(raw, 'c2'), r2: str(raw, 'r2', '1'), int: raw.int === true };
    case 'guide':
      return { k: 'guide', p: str(raw, 'p'), b: str(raw, 'b'), g1: str(raw, 'g1'), g2: str(raw, 'g2') };
    case 'trans':
      return { k: 'trans', b: str(raw, 'b') };
  }
  return null;
}
function parseLoad(raw: unknown): MLoad | null {
  if (!isObj(raw)) return null;
  switch (raw.k) {
    case 'force':
      return { k: 'force', p: str(raw, 'p'), F: str(raw, 'F', '1'), ang: str(raw, 'ang', '0'), ref: str(raw, 'ref'), ref2: str(raw, 'ref2'), unknown: raw.unknown === true };
    case 'couple':
      return { k: 'couple', b: str(raw, 'b'), M: str(raw, 'M', '1'), unknown: raw.unknown === true };
    case 'hinge':
      return { k: 'hinge', b1: str(raw, 'b1'), b2: str(raw, 'b2'), M: str(raw, 'M', '1') };
  }
  return null;
}
function parseMass(raw: unknown): MMass | null {
  if (!isObj(raw)) return null;
  switch (raw.k) {
    case 'point':
      return { k: 'point', p: str(raw, 'p'), m: str(raw, 'm', '1') };
    case 'rod':
      return { k: 'rod', p1: str(raw, 'p1'), p2: str(raw, 'p2'), m: str(raw, 'm', '1') };
    case 'body':
      return { k: 'body', b: str(raw, 'b'), c: str(raw, 'c'), m: str(raw, 'm', '1'), shape: raw.shape === 'ring' ? 'ring' : raw.shape === 'J' ? 'J' : 'disk', r: str(raw, 'r', '1'), J: str(raw, 'J', '1') };
  }
  return null;
}
function parseDrive(raw: unknown): MDrive | null {
  if (!isObj(raw)) return null;
  switch (raw.k) {
    case 'omega':
      return { k: 'omega', b: str(raw, 'b'), w: str(raw, 'w', '1'), e: str(raw, 'e', '0') };
    case 'proj':
      return { k: 'proj', p: str(raw, 'p'), ang: str(raw, 'ang', '0'), v: str(raw, 'v', '1'), a: str(raw, 'a', '0') };
    case 'vec':
      return { k: 'vec', p: str(raw, 'p'), v: str(raw, 'v', '1'), vang: str(raw, 'vang', '0'), a: str(raw, 'a', '0'), aang: str(raw, 'aang', '0') };
  }
  return null;
}

export function parseMech(raw: unknown): { ok: true; problem: MechProblem } | { ok: false; errors: string[] } {
  const bad = { ok: false as const, errors: ['В файле нет механизма (problem с массивами points, bodies, cons, drives).'] };
  if (!isObj(raw) || !['points', 'bodies', 'cons', 'drives'].every((k) => Array.isArray(raw[k]))) return bad;
  const arr = (k: string) => (raw[k] as unknown[]).slice(0, MAX_ITEMS);
  const points: MPoint[] = [];
  for (const p of arr('points')) {
    const def = isObj(p) ? parseDef(p.def) : null;
    if (!isObj(p) || !def) return { ok: false, errors: ['Точка механизма записана неверно.'] };
    points.push({ name: str(p, 'name').slice(0, 12), def });
  }
  const bodies: MBody[] = [];
  for (const b of arr('bodies')) {
    if (!isObj(b) || !Array.isArray(b.pts)) return { ok: false, errors: ['Звено механизма записано неверно.'] };
    bodies.push({ name: str(b, 'name').slice(0, 12), pts: (b.pts as unknown[]).filter((q): q is string => typeof q === 'string').slice(0, MAX_ITEMS) });
  }
  const cons = arr('cons').map(parseCons);
  const drives = arr('drives').map(parseDrive);
  if (cons.some((c) => !c) || drives.some((d) => !d)) return { ok: false, errors: ['Связь или ведущее звено записаны неверно.'] };
  const opt = (k: string) => (Array.isArray(raw[k]) ? (raw[k] as unknown[]).slice(0, MAX_ITEMS) : []);
  const loads = opt('loads').map(parseLoad);
  const masses = opt('masses').map(parseMass);
  if (loads.some((l) => !l) || masses.some((m) => !m)) return { ok: false, errors: ['Нагрузка или масса механизма записаны неверно.'] };
  const problem: MechProblem = { points, bodies, cons: cons as MCons[], drives: drives as MDrive[] };
  if (raw.acc === false) problem.acc = false;
  if (loads.length) problem.loads = loads as MLoad[];
  if (masses.length) problem.masses = masses as MMass[];
  if (typeof raw.g === 'string' && raw.g) problem.g = str(raw, 'g');
  if (isObj(raw.param)) problem.param = { val: str(raw.param, 'val', '0'), from: str(raw.param, 'from', '0'), to: str(raw.param, 'to', '360') };
  if (isObj(raw.energy)) problem.energy = { phi0: str(raw.energy, 'phi0', '0'), w0: str(raw.energy, 'w0', '0') };
  if (typeof raw.plot === 'string' && raw.plot) problem.plot = str(raw, 'plot');
  return { ok: true, problem };
}

/* ---------- значения по умолчанию для новых элементов ---------- */
export function newDef(k: PtDef['k'], names: string[]): PtDef {
  const a = names[0] ?? '',
    b = names[1] ?? a;
  switch (k) {
    case 'xy':
      return { k, x: '0', y: '0' };
    case 'polar':
      return { k, from: a, L: '1', ang: '0' };
    case 'two':
      return { k, p1: a, L1: '1', p2: b, L2: '1', side: 1 };
    case 'line':
      return { k, from: a, L: '1', through: b, ang: '0', side: 1 };
    case 'seg':
      return { k, p1: a, p2: b, t: '1/2' };
    case 'cross':
      return { k, p1: a, q1: '', a1: '0', p2: b, q2: '', a2: '90' };
  }
}
export function newCons(k: MCons['k'], pts: string[], bodies: string[]): MCons {
  const p = pts[0] ?? '',
    b = bodies[0] ?? '';
  switch (k) {
    case 'fixed':
      return { k, p };
    case 'slider':
      return { k, p, ang: '0' };
    case 'roll':
      return { k, b, c: p, r: '1', ang: '0' };
    case 'gear':
      return { k, b1: b, c1: p, r1: '1', b2: '', c2: pts[1] ?? p, r2: '1', int: false };
    case 'guide':
      return { k, p: pts[pts.length - 1] ?? p, b: bodies[bodies.length - 1] ?? b, g1: p, g2: pts[1] ?? p };
    case 'trans':
      return { k, b: bodies[bodies.length - 1] ?? b };
  }
}
export function newLoad(k: MLoad['k'], pts: string[], bodies: string[]): MLoad {
  switch (k) {
    case 'force':
      return { k, p: pts[pts.length - 1] ?? '', F: '1', ang: '-90', ref: '', ref2: '', unknown: false };
    case 'couple':
      return { k, b: bodies[0] ?? '', M: '1', unknown: false };
    case 'hinge':
      return { k, b1: bodies[0] ?? '', b2: '', M: '1' };
  }
}
export function newMass(k: MMass['k'], pts: string[], bodies: string[]): MMass {
  switch (k) {
    case 'point':
      return { k, p: pts[pts.length - 1] ?? '', m: '1' };
    case 'rod':
      return { k, p1: pts[0] ?? '', p2: pts[1] ?? '', m: '1' };
    case 'body':
      return { k, b: bodies[0] ?? '', c: pts[0] ?? '', m: '1', shape: 'disk', r: '1', J: '1' };
  }
}
export function newDrive(k: MDrive['k'], pts: string[], bodies: string[]): MDrive {
  switch (k) {
    case 'omega':
      return { k, b: bodies[0] ?? '', w: '1', e: '0' };
    case 'proj':
      return { k, p: pts[0] ?? '', ang: '0', v: '1', a: '0' };
    case 'vec':
      return { k, p: pts[0] ?? '', v: '1', vang: '0', a: '0', aang: '0' };
  }
}
const nextName = (used: string[], base: string) => {
  const letters = 'ABCDEFGHKLMNPQRSTUVWXYZ';
  if (base === 'pt') for (const L of letters) if (!used.includes(L)) return L;
  for (let i = 1; ; i++) if (!used.includes(`${base === 'pt' ? 'P' : base}${i}`)) return `${base === 'pt' ? 'P' : base}${i}`;
};

export class MechStore {
  private st: MechState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: MechPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm1812';
    this.st = { problem: copy(MECH_PRESETS[k].problem as MechProblem), title: MECH_PRESETS[k].title, preset: k, show: 'v', canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): MechState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<MechState>) {
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
  private edit(fn: (p: MechProblem) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  private change(fn: (p: MechProblem) => void) {
    this.commit();
    this.edit(fn);
  }
  private static put(p: MechProblem, path: Path, v: unknown) {
    let o: Record<string | number, unknown> = p as unknown as Record<string, unknown>;
    for (const k of path.slice(0, -1)) o = o[k] as Record<string | number, unknown>;
    o[path[path.length - 1]] = v;
  }
  loadPreset = (k: MechPresetKey) => {
    this.commit();
    this.set({ problem: copy(MECH_PRESETS[k].problem as MechProblem), title: MECH_PRESETS[k].title, preset: k });
  };
  setShow = (show: 'v' | 'a') => this.set({ show });
  /** Набор текста в поле (одна запись истории на серию правок). */
  type = (path: Path, v: string) => {
    this.touch(path.join('.'));
    this.edit((p) => MechStore.put(p, path, v.slice(0, 120)));
  };
  /** Выбор в списке — отдельная запись истории. */
  pick = (path: Path, v: unknown) => this.change((p) => MechStore.put(p, path, v));
  renamePoint = (i: number, name: string) => {
    const old = this.st.problem.points[i].name;
    const nm = name.replace(/\s/g, '').slice(0, 12);
    this.touch(`pn:${i}`);
    this.edit((p) => {
      p.points[i].name = nm;
      if (!old || p.points.some((q, j) => j !== i && q.name === nm)) return;
      const R = (s: string) => (s === old ? nm : s);
      for (const q of p.points) {
        const d = q.def as unknown as Record<string, unknown>;
        for (const f of ['from', 'p1', 'p2', 'through', 'q1', 'q2', 'to']) if (typeof d[f] === 'string') d[f] = R(d[f] as string);
      }
      for (const b of p.bodies) b.pts = b.pts.map(R);
      for (const c of p.cons) {
        const o = c as unknown as Record<string, unknown>;
        for (const f of ['p', 'c', 'c1', 'c2', 'g1', 'g2']) if (typeof o[f] === 'string') o[f] = R(o[f] as string);
      }
      for (const d of p.drives) if (d.k !== 'omega') d.p = R(d.p);
      for (const x of [...(p.loads ?? []), ...(p.masses ?? [])]) {
        const o = x as unknown as Record<string, unknown>;
        for (const f of ['p', 'c', 'p1', 'p2', 'ref', 'ref2']) if (typeof o[f] === 'string') o[f] = R(o[f] as string);
      }
      if (p.plot?.includes(':')) p.plot = p.plot.replace(/^(x|y|v|vx|vy|a|ax|ay|vr|ar):(.*)$/, (m, k, n) => (n === old ? `${k}:${nm}` : m));
    });
  };
  renameBody = (i: number, name: string) => {
    const old = this.st.problem.bodies[i].name;
    const nm = name.replace(/\s/g, '').slice(0, 12);
    this.touch(`bn:${i}`);
    this.edit((p) => {
      p.bodies[i].name = nm;
      if (!old || p.bodies.some((q, j) => j !== i && q.name === nm)) return;
      const R = (s: string) => (s === old ? nm : s);
      for (const c of [...p.cons, ...(p.loads ?? []), ...(p.masses ?? [])]) {
        const o = c as unknown as Record<string, unknown>;
        for (const f of ['b', 'b1', 'b2']) if (typeof o[f] === 'string') o[f] = R(o[f] as string);
      }
      for (const d of p.drives) if (d.k === 'omega') d.b = R(d.b);
      if (p.plot?.includes(':')) p.plot = p.plot.replace(/^(w|e):(.*)$/, (m, k, n) => (n === old ? `${k}:${nm}` : m));
    });
  };
  setPointKind = (i: number, k: PtDef['k']) =>
    this.change((p) => {
      const before = p.points.slice(0, i).map((q) => q.name);
      p.points[i].def = newDef(k, before.length ? before : p.points.filter((_, j) => j !== i).map((q) => q.name));
    });
  addPoint = () => {
    const p = this.st.problem;
    if (p.points.length >= MAX_ITEMS) return;
    this.change((q) => q.points.push({ name: nextName(q.points.map((x) => x.name), 'pt'), def: q.points.length ? newDef('polar', [q.points[q.points.length - 1].name]) : newDef('xy', []) }));
  };
  removePoint = (i: number) => this.change((p) => p.points.splice(i, 1));
  movePoint = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= this.st.problem.points.length) return;
    this.change((p) => ([p.points[i], p.points[j]] = [p.points[j], p.points[i]]));
  };
  toggleBodyPt = (i: number, name: string) =>
    this.change((p) => {
      const b = p.bodies[i];
      b.pts = b.pts.includes(name) ? b.pts.filter((q) => q !== name) : p.points.map((q) => q.name).filter((q) => q === name || b.pts.includes(q));
    });
  addBody = () => {
    if (this.st.problem.bodies.length >= MAX_ITEMS) return;
    this.change((p) => p.bodies.push({ name: nextName(p.bodies.map((b) => b.name), 'звено'), pts: [] }));
  };
  removeBody = (i: number) => this.change((p) => p.bodies.splice(i, 1));
  addCons = (k: MCons['k']) => {
    if (this.st.problem.cons.length >= MAX_ITEMS) return;
    this.change((p) => p.cons.push(newCons(k, p.points.map((q) => q.name), p.bodies.map((b) => b.name))));
  };
  setConsKind = (i: number, k: MCons['k']) => this.change((p) => (p.cons[i] = newCons(k, p.points.map((q) => q.name), p.bodies.map((b) => b.name))));
  removeCons = (i: number) => this.change((p) => p.cons.splice(i, 1));
  addDrive = (k: MDrive['k']) => {
    if (this.st.problem.drives.length >= 4) return;
    this.change((p) => p.drives.push(newDrive(k, p.points.map((q) => q.name), p.bodies.map((b) => b.name))));
  };
  setDriveKind = (i: number, k: MDrive['k']) => this.change((p) => (p.drives[i] = newDrive(k, p.points.map((q) => q.name), p.bodies.map((b) => b.name))));
  removeDrive = (i: number) => this.change((p) => p.drives.splice(i, 1));
  /* Силы и массы. */
  addLoad = (k: MLoad['k']) => {
    if ((this.st.problem.loads ?? []).length >= MAX_ITEMS) return;
    this.change((p) => (p.loads = [...(p.loads ?? []), newLoad(k, p.points.map((q) => q.name), p.bodies.map((b) => b.name))]));
  };
  setLoadKind = (i: number, k: MLoad['k']) => this.change((p) => (p.loads![i] = newLoad(k, p.points.map((q) => q.name), p.bodies.map((b) => b.name))));
  removeLoad = (i: number) => this.change((p) => p.loads!.splice(i, 1));
  /** Направление силы: от оси x (ref = '') или от направления отрезка ref→ref2. */
  setLoadRef = (i: number, ref: string, ref2: string) =>
    this.change((p) => {
      const l = p.loads![i];
      if (l.k === 'force') (l.ref = ref), (l.ref2 = ref2);
    });
  /** Отметка «неизвестная» — только у одной нагрузки. */
  setUnknown = (i: number, on: boolean) =>
    this.change((p) =>
      p.loads!.forEach((l, j) => {
        if (l.k !== 'hinge') l.unknown = j === i ? on : false;
      }),
    );
  addMass = (k: MMass['k']) => {
    if ((this.st.problem.masses ?? []).length >= MAX_ITEMS) return;
    this.change((p) => (p.masses = [...(p.masses ?? []), newMass(k, p.points.map((q) => q.name), p.bodies.map((b) => b.name))]));
  };
  setMassKind = (i: number, k: MMass['k']) => this.change((p) => (p.masses![i] = newMass(k, p.points.map((q) => q.name), p.bodies.map((b) => b.name))));
  removeMass = (i: number) => this.change((p) => p.masses!.splice(i, 1));
  setAcc = (on: boolean) => this.change((p) => (on ? delete p.acc : (p.acc = false)));
  setParam = (on: boolean) => this.change((p) => (p.param = on ? { val: '30', from: '0', to: '360' } : null));
  setEnergy = (on: boolean) => this.change((p) => (p.energy = on ? { phi0: p.param?.from ?? '0', w0: '0' } : null));
  setPlot = (key: string) => this.change((p) => (p.plot = key));
  setGravity = (on: boolean) => this.change((p) => (p.g = on ? '9.81' : ''));
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
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(MECH_MODULE, this.st.title, { problem: this.st.problem }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== MECH_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseMech(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Плоский механизм';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
