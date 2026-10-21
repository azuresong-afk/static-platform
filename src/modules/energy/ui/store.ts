/** Состояние вкладки «Кинетическая энергия»: тела, связи, что ищем; история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import { ATTACHES, type Attach, type Body, type BodyKind, type EnergyMode, type EnergyProblem, type InertiaKind } from '../model/energy';
import { ENERGY_PRESETS, type EnergyPresetKey } from '../presets';

export const ENERGY_MODULE = 'energy';
const MAX_BODIES = 6;
const KINDS: BodyKind[] = ['translate', 'rotate', 'roll'];
const INERTIAS: InertiaKind[] = ['disk', 'ring', 'rho', 'J'];
const MODES: EnergyMode[] = ['v', 's', 'v0'];
/** Числовые поля тела. */
export const NUM_KEYS = ['m', 'R', 'r', 'I', 'alpha', 'f', 'fk', 'F', 'c', 'lambda0'] as const;
export type NumKey = (typeof NUM_KEYS)[number];

export const newBody = (i: number, from: number | null, fromKind: BodyKind | null): Body => ({
  name: '',
  kind: 'rotate',
  m: 1,
  R: 0.2,
  r: 0,
  inertia: 'disk',
  I: 0,
  alpha: 90,
  up: false,
  f: 0,
  fk: 0,
  M: [0, 0, 0],
  F: 0,
  c: 0,
  lambda0: 0,
  link: from == null || fromKind == null ? null : { from, at: ATTACHES[fromKind][0], to: 'R' },
  ...(i === 0 ? { kind: 'translate' as const } : {}),
});

export interface EnergyState {
  problem: EnergyProblem;
  title: string;
  preset: EnergyPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: EnergyProblem;
  title: string;
  preset: EnergyState['preset'];
}
const copy = (p: EnergyProblem): EnergyProblem => structuredClone(p);

export function parseEnergy(raw: unknown): { ok: true; problem: EnergyProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !Array.isArray(raw.bodies) || !MODES.includes(raw.mode as EnergyMode) || ![raw.v0, raw.s, raw.v1].every(isNum)) return { ok: false, errors: ['В файле нет задачи (problem с полями bodies, mode, v0, s, v1).'] };
  const e: string[] = [];
  const bodies: Body[] = raw.bodies.flatMap((q: unknown, i) => {
    if (!isObj(q) || !KINDS.includes(q.kind as BodyKind) || !INERTIAS.includes(q.inertia as InertiaKind) || !NUM_KEYS.every((k) => isNum(q[k])) || !Array.isArray(q.M) || q.M.length !== 3 || !q.M.every(isNum))
      return (e.push(`Тело №${i + 1}: неполные данные.`), []);
    let link: Body['link'] = null;
    if (i > 0) {
      const L = q.link;
      if (!isObj(L) || !isNum(L.from) || typeof L.at !== 'string' || typeof L.to !== 'string') return (e.push(`Тело №${i + 1}: нет связи с предыдущим телом.`), []);
      link = { from: L.from, at: L.at as Attach, to: L.to as Attach };
    }
    const nums = Object.fromEntries(NUM_KEYS.map((k) => [k, q[k] as number])) as Record<NumKey, number>;
    return [{ name: typeof q.name === 'string' ? q.name.slice(0, 20) : '', kind: q.kind as BodyKind, inertia: q.inertia as InertiaKind, up: q.up === true, M: q.M as [number, number, number], link, ...nums }];
  });
  if (!bodies.length || bodies.length > MAX_BODIES) e.push(`Тел должно быть от 1 до ${MAX_BODIES}.`);
  return e.length ? { ok: false, errors: e } : { ok: true, problem: { bodies, byWeight: raw.byWeight === true, mode: raw.mode as EnergyMode, v0: raw.v0 as number, s: raw.s as number, v1: raw.v1 as number } };
}

export class EnergyStore {
  private st: EnergyState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: EnergyPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm3845';
    this.st = { problem: copy(ENERGY_PRESETS[k].problem as EnergyProblem), title: ENERGY_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): EnergyState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<EnergyState>) {
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
  private edit(fn: (p: EnergyProblem) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  loadPreset = (k: EnergyPresetKey) => {
    this.commit();
    this.set({ problem: copy(ENERGY_PRESETS[k].problem as EnergyProblem), title: ENERGY_PRESETS[k].title, preset: k });
  };
  addBody = () => {
    const n = this.st.problem.bodies.length;
    if (n >= MAX_BODIES) return;
    this.commit();
    this.edit((p) => p.bodies.push(newBody(n, n - 1, p.bodies[n - 1].kind)));
  };
  /** Убрать тело: связи на него переходят к предыдущему телу. */
  removeBody = (i: number) => {
    if (this.st.problem.bodies.length <= 1) return;
    this.commit();
    this.edit((p) => {
      p.bodies.splice(i, 1);
      p.bodies.forEach((b, j) => {
        if (j === 0) return void (b.link = null);
        if (!b.link) return void (b.link = { from: 0, at: ATTACHES[p.bodies[0].kind][0], to: ATTACHES[b.kind][0] });
        if (b.link.from === i) {
          b.link.from = Math.max(0, i - 1);
          b.link.at = ATTACHES[p.bodies[b.link.from].kind][0];
        } else if (b.link.from > i) b.link.from--;
      });
    });
  };
  setKind = (i: number, kind: BodyKind) => {
    this.commit();
    this.edit((p) => {
      const b = p.bodies[i];
      b.kind = kind;
      if (kind !== 'translate' && !(b.R > 0) && !(b.r > 0)) b.R = 0.2;
      if (kind === 'roll' && !(b.r > 0)) b.r = b.R || 0.2;
      if (b.link && !ATTACHES[kind].includes(b.link.to)) b.link.to = ATTACHES[kind][0];
      p.bodies.forEach((c) => {
        if (c.link?.from === i && !ATTACHES[kind].includes(c.link.at)) c.link.at = ATTACHES[kind][0];
      });
    });
  };
  setInertia = (i: number, k: InertiaKind) => {
    this.commit();
    this.edit((p) => (p.bodies[i].inertia = k));
  };
  setUp = (i: number, up: boolean) => {
    this.commit();
    this.edit((p) => (p.bodies[i].up = up));
  };
  setLink = (i: number, part: 'from' | 'at' | 'to', val: string) => {
    this.commit();
    this.edit((p) => {
      const L = p.bodies[i].link!;
      if (part === 'from') {
        L.from = +val;
        L.at = ATTACHES[p.bodies[L.from].kind][0];
      } else L[part] = val as Attach;
    });
  };
  typeName = (i: number, name: string) => {
    this.touch(`b:${i}:name`);
    this.edit((p) => (p.bodies[i].name = name.slice(0, 20)));
  };
  /** key: числовое поле или M0, M1, M2. */
  typeBody = (i: number, key: string, v: number) => {
    this.touch(`b:${i}:${key}`);
    this.edit((p) => {
      const b = p.bodies[i];
      if (/^M[012]$/.test(key)) b.M[+key[1]] = v;
      else b[key as NumKey] = v;
    });
  };
  setByWeight = (on: boolean) => {
    this.commit();
    this.edit((p) => (p.byWeight = on));
  };
  setMode = (m: EnergyMode) => {
    this.commit();
    this.edit((p) => (p.mode = m));
  };
  typeTop = (key: 'v0' | 's' | 'v1', v: number) => {
    this.touch(`t:${key}`);
    this.edit((p) => (p[key] = v));
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
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(ENERGY_MODULE, this.st.title, { problem: this.st.problem }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== ENERGY_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseEnergy(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Кинетическая энергия';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
