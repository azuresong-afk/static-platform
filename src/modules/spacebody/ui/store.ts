/** Состояние вкладки «Пространственное тело»: тело, история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { Axis, Body, BodyForce, BodyPair, BodySupport, SupportKind, V3 } from '../model/body';
import { BODY_PRESETS, type BodyPresetKey } from '../presets';

export const BODY_MODULE = 'spacebody';
const MAX_POINTS = 24;
const LETTERS = 'ABCDEHKLMNOPQRTUVWZ'.split('');

export interface BodyState {
  body: Body;
  title: string;
  preset: BodyPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  body: Body;
  title: string;
  preset: BodyState['preset'];
}

const copy = (b: Body): Body => structuredClone(b);
const isV3 = (v: unknown): v is V3 => Array.isArray(v) && v.length === 3 && v.every(isNum);
const KINDS: SupportKind[] = ['ball', 'thrust', 'bearing', 'rod', 'normal'];

export function parseBody(raw: unknown): { ok: true; body: Body } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !Array.isArray(raw.points) || !Array.isArray(raw.supports) || !Array.isArray(raw.forces))
    return { ok: false, errors: ['В файле нет тела (body с полями points, supports, forces).'] };
  const e: string[] = [];
  const n = raw.points.length;
  const idx = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;
  const points = raw.points.flatMap((p: unknown, i) =>
    isObj(p) && typeof p.name === 'string' && isNum(p.x) && isNum(p.y) && isNum(p.z) ? [{ name: p.name.slice(0, 3), x: p.x, y: p.y, z: p.z }] : (e.push(`Точка №${i + 1}: имя и координаты x, y, z.`), []),
  );
  const supports: BodySupport[] = raw.supports.flatMap((s: unknown, j) =>
    isObj(s) && KINDS.includes(s.kind as SupportKind) && idx(s.at) && (s.kind !== 'rod' || idx(s.to)) && (s.kind !== 'normal' || isV3(s.n)) && (s.kind !== 'bearing' || ['x', 'y', 'z'].includes(s.axis as string))
      ? [{ kind: s.kind as SupportKind, at: s.at as number, ...(s.kind === 'bearing' ? { axis: s.axis as Axis } : {}), ...(s.kind === 'rod' ? { to: s.to as number } : {}), ...(s.kind === 'normal' ? { n: s.n as V3 } : {}) }]
      : (e.push(`Опора №${j + 1}: вид, точка и параметры.`), []),
  );
  const forces: BodyForce[] = raw.forces.flatMap((f: unknown, j) =>
    isObj(f) && idx(f.at) && (f.mode === 'comp' ? isV3(f.c) : f.mode === 'toward' && idx(f.to) && isNum(f.F))
      ? [
          {
            at: f.at as number,
            mode: f.mode as 'comp' | 'toward',
            F: isNum(f.F) ? f.F : 0,
            ...(f.mode === 'comp' ? { c: f.c as V3 } : { to: f.to as number }),
            ...(f.unknown === true ? { unknown: true } : {}),
            ...(typeof f.name === 'string' ? { name: f.name.slice(0, 3) } : {}),
          },
        ]
      : (e.push(`Сила №${j + 1}: точка и составляющие или направление к точке.`), []),
  );
  const pairs: BodyPair[] = Array.isArray(raw.pairs) ? raw.pairs.flatMap((p: unknown) => (isObj(p) && isV3(p.M) ? [{ M: p.M, ...(typeof p.name === 'string' ? { name: p.name.slice(0, 3) } : {}) }] : [])) : [];
  const edges = Array.isArray(raw.edges) ? (raw.edges.filter((q) => Array.isArray(q) && idx(q[0]) && idx(q[1])) as [number, number][]) : [];
  const faces = Array.isArray(raw.faces) ? (raw.faces.filter((q) => Array.isArray(q) && q.length >= 3 && q.every(idx)) as number[][]) : [];
  if (n < 1 || n > MAX_POINTS) e.push(`Точек должно быть от 1 до ${MAX_POINTS}.`);
  return e.length ? { ok: false, errors: e } : { ok: true, body: { points, supports, forces, pairs, edges, faces } };
}

export class BodyStore {
  private st: BodyState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();

  constructor(opts: { preset?: BodyPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm824';
    this.st = { body: copy(BODY_PRESETS[k].body as Body), title: BODY_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): BodyState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<BodyState>) {
    this.st = { ...this.st, ...patch, canUndo: this.hist.canUndo, canRedo: this.hist.canRedo };
    this.listeners.forEach((f) => f());
  }
  private snap = (): Snap => ({ body: this.st.body, title: this.st.title, preset: this.st.preset });
  private commit() {
    this.hist.push(this.snap());
    if (this.st.preset !== 'custom') this.st = { ...this.st, preset: 'custom', title: 'Своё тело' };
  }
  private touch(key: string) {
    if (this.hist.startSession(key)) this.commit();
  }
  endSession = (key: string) => this.hist.endSession(key);
  private edit(fn: (b: Body) => void) {
    const b = copy(this.st.body);
    fn(b);
    this.set({ body: b });
  }

  loadPreset = (k: BodyPresetKey) => {
    this.commit();
    this.set({ body: copy(BODY_PRESETS[k].body as Body), title: BODY_PRESETS[k].title, preset: k });
  };
  typePoint = (i: number, key: 'x' | 'y' | 'z', v: number) => {
    this.touch(`pt:${i}:${key}`);
    this.edit((b) => (b.points[i][key] = v));
  };
  addPoint = () => {
    const b = this.st.body;
    if (b.points.length >= MAX_POINTS) return;
    this.commit();
    const name = LETTERS.find((l) => !b.points.some((p) => p.name === l)) ?? 'P' + b.points.length;
    this.edit((x) => x.points.push({ name, x: 0, y: 0, z: 0 }));
  };
  /** Убрать точку со всем, что к ней привязано; номера следующих точек сдвигаются. */
  removePoint = (i: number) => {
    if (this.st.body.points.length <= 1) return;
    this.commit();
    const sh = (j: number) => (j > i ? j - 1 : j);
    this.edit((b) => {
      b.points.splice(i, 1);
      b.supports = b.supports.filter((s) => s.at !== i && s.to !== i).map((s) => ({ ...s, at: sh(s.at), ...(s.to != null ? { to: sh(s.to) } : {}) }));
      b.forces = b.forces.filter((f) => f.at !== i && f.to !== i).map((f) => ({ ...f, at: sh(f.at), ...(f.to != null ? { to: sh(f.to) } : {}) }));
      b.edges = b.edges.filter((q) => !q.includes(i)).map((q) => [sh(q[0]), sh(q[1])] as [number, number]);
      b.faces = b.faces.filter((q) => !q.includes(i)).map((q) => q.map(sh));
    });
  };
  addSupport = () => {
    this.commit();
    this.edit((b) => b.supports.push({ kind: 'ball', at: 0 }));
  };
  setSupport = (j: number, patch: Partial<BodySupport>) => {
    this.commit();
    this.edit((b) => {
      const s = { ...b.supports[j], ...patch };
      if (s.kind === 'bearing') s.axis ??= 'z';
      if (s.kind === 'rod') s.to ??= s.at === 0 ? Math.min(1, b.points.length - 1) : 0;
      if (s.kind === 'normal') s.n ??= [0, 0, 1];
      b.supports[j] = s;
    });
  };
  typeSupportN = (j: number, i: number, v: number) => {
    this.touch(`sup:${j}:${i}`);
    this.edit((b) => {
      const n = [...(b.supports[j].n ?? [0, 0, 1])] as V3;
      n[i] = v;
      b.supports[j].n = n;
    });
  };
  removeSupport = (j: number) => {
    this.commit();
    this.edit((b) => b.supports.splice(j, 1));
  };
  addForce = () => {
    this.commit();
    this.edit((b) => b.forces.push({ at: 0, mode: 'comp', F: 1, c: [0, 0, -1], name: 'F' }));
  };
  setForce = (j: number, patch: Partial<BodyForce>) => {
    this.commit();
    this.edit((b) => {
      const f = { ...b.forces[j], ...patch };
      if (f.mode === 'toward') f.to ??= f.at === 0 ? Math.min(1, b.points.length - 1) : 0;
      if (f.mode === 'comp') f.c ??= [0, 0, -1];
      b.forces[j] = f;
    });
  };
  typeForce = (j: number, key: 'F' | 0 | 1 | 2, v: number) => {
    this.touch(`f:${j}:${key}`);
    this.edit((b) => {
      const f = b.forces[j];
      if (key === 'F') f.F = v;
      else {
        const c = [...(f.c ?? [0, 0, 0])] as V3;
        c[key] = v;
        f.c = c;
      }
    });
  };
  removeForce = (j: number) => {
    this.commit();
    this.edit((b) => b.forces.splice(j, 1));
  };
  undo = () => {
    const p = this.hist.undo(this.snap());
    if (p) this.set(p);
  };
  redo = () => {
    const p = this.hist.redo(this.snap());
    if (p) this.set(p);
  };
  notify = (text: string, tone: 'ok' | 'bad' = 'ok') => this.set({ notice: { text, tone, seq: (this.st.notice?.seq ?? 0) + 1 } });
  closeNotice = () => this.set({ notice: null });
  setExplain = (explain: boolean) => this.set({ explain });
  projectTitle = () => this.st.title;
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(BODY_MODULE, this.st.title, { body: this.st.body }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== BODY_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseBody(env.raw.body);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Тело';
    this.set({ body: r.body, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
