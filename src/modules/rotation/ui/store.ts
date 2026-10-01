/** Состояние вкладки «Вращение тела»: уравнение вращения или сохранение кинетического момента; отмена, файл. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { DrumLoad, InertiaKind, KItem, RotEq, RotProblem } from '../model/rotation';
import { ROT_PRESETS, type RotPresetKey } from '../presets';

export const ROT_MODULE = 'rotation';
const MAX_ITEMS = 8;
const EQ_NUM = ['M0', 'at', 'm0', 'p', 'c', 'Pa', 'kv', 'kq', 'Mf', 'phi0', 'omega0', 't', 'omega1'] as const;
export type EqNumKey = (typeof EQ_NUM)[number];
const K_NUM = ['J1', 'J2', 'm', 'r1', 'r2', 'w1', 'u1', 'u2'] as const;
export type KNumKey = (typeof K_NUM)[number];

export interface RotState {
  problem: RotProblem;
  title: string;
  preset: RotPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: RotProblem;
  title: string;
  preset: RotState['preset'];
}
const copy = (p: RotProblem): RotProblem => structuredClone(p);

export const DEFAULT_EQ: RotEq = { body: { kind: 'disk', m: 10, R: 0.5, J: 1 }, loads: [], M0: 5, at: 0, m0: 0, p: 0, c: 0, Pa: 0, kv: 0, kq: 0, Mf: 0, phi0: 0, omega0: 0, ask: 't', t: 2, omega1: 0 };
export const newItem = (kind: KItem['kind']): KItem => ({ name: '', kind, J1: 1, J2: 1, m: 1, r1: 0.5, r2: 0.5, w1: 0, u1: 0, u2: 0 });

export function parseRot(raw: unknown): { ok: true; problem: RotProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw) || (raw.mode !== 'eq' && raw.mode !== 'K') || !isObj(raw.eq) || !Array.isArray(raw.K)) return { ok: false, errors: ['В файле нет задачи (problem с полями mode, eq, K).'] };
  const e: string[] = [];
  const q = raw.eq;
  const body = q.body;
  if (!isObj(body) || !['J', 'disk', 'ring', 'rho'].includes(body.kind as string) || ![body.m, body.R, body.J].every(isNum)) e.push('Тело: неполные данные.');
  if (!EQ_NUM.every((k) => isNum(q[k])) || (q.ask !== 't' && q.ask !== 'omega') || !Array.isArray(q.loads)) e.push('Уравнение вращения: неполные данные.');
  const loads: DrumLoad[] = Array.isArray(q.loads) ? q.loads.flatMap((l: unknown) => (isObj(l) && isNum(l.m) && isNum(l.r) ? [{ m: l.m, r: l.r, down: l.down === true }] : (e.push('Груз на барабане: неполные данные.'), []))) : [];
  const K: KItem[] = raw.K.flatMap((it: unknown, i) =>
    isObj(it) && (it.kind === 'body' || it.kind === 'point') && K_NUM.every((k) => isNum(it[k])) ? [{ name: typeof it.name === 'string' ? it.name.slice(0, 20) : '', kind: it.kind, ...(Object.fromEntries(K_NUM.map((k) => [k, it[k]])) as Record<KNumKey, number>) }] : (e.push(`Тело №${i + 1}: неполные данные.`), []),
  );
  if (raw.mode === 'K' && !K.length) e.push('Нет ни одного тела.');
  if (e.length) return { ok: false, errors: e };
  const b = body as Record<string, number | string>;
  const eq: RotEq = { body: { kind: b.kind as InertiaKind, m: b.m as number, R: b.R as number, J: b.J as number }, loads, ask: q.ask as 't' | 'omega', ...(Object.fromEntries(EQ_NUM.map((k) => [k, q[k]])) as Record<EqNumKey, number>) };
  return { ok: true, problem: { mode: raw.mode, byWeight: raw.byWeight === true, eq, K } };
}

export class RotStore {
  private st: RotState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: RotPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm3745';
    this.st = { problem: copy(ROT_PRESETS[k].problem as RotProblem), title: ROT_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): RotState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<RotState>) {
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
  private edit(fn: (p: RotProblem) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  loadPreset = (k: RotPresetKey) => {
    this.commit();
    this.set({ problem: copy(ROT_PRESETS[k].problem as RotProblem), title: ROT_PRESETS[k].title, preset: k });
  };
  setMode = (mode: RotProblem['mode']) => {
    if (mode === this.st.problem.mode) return;
    this.commit();
    this.edit((p) => {
      p.mode = mode;
      if (mode === 'K' && !p.K.length) p.K = [{ ...newItem('body'), J1: 2, J2: 1, w1: 1 }];
    });
  };
  setByWeight = (on: boolean) => {
    this.commit();
    this.edit((p) => (p.byWeight = on));
  };
  /* уравнение */
  setBodyKind = (k: InertiaKind) => {
    this.commit();
    this.edit((p) => (p.eq.body.kind = k));
  };
  typeBody = (key: 'm' | 'R' | 'J', v: number) => {
    this.touch(`body:${key}`);
    this.edit((p) => (p.eq.body[key] = v));
  };
  typeEq = (key: EqNumKey, v: number) => {
    this.touch(`eq:${key}`);
    this.edit((p) => (p.eq[key] = v));
  };
  setAsk = (ask: RotEq['ask']) => {
    this.commit();
    this.edit((p) => (p.eq.ask = ask));
  };
  addLoad = () => {
    if (this.st.problem.eq.loads.length >= 4) return;
    this.commit();
    this.edit((p) => p.eq.loads.push({ m: 1, r: 0.2, down: true }));
  };
  removeLoad = (i: number) => {
    this.commit();
    this.edit((p) => p.eq.loads.splice(i, 1));
  };
  typeLoad = (i: number, key: 'm' | 'r', v: number) => {
    this.touch(`load:${i}:${key}`);
    this.edit((p) => (p.eq.loads[i][key] = v));
  };
  setLoadDown = (i: number, down: boolean) => {
    this.commit();
    this.edit((p) => (p.eq.loads[i].down = down));
  };
  /* сохранение кинетического момента */
  addItem = (kind: KItem['kind']) => {
    if (this.st.problem.K.length >= MAX_ITEMS) return;
    this.commit();
    this.edit((p) => p.K.push({ ...newItem(kind), w1: p.K[0]?.w1 ?? 0 }));
  };
  removeItem = (i: number) => {
    if (this.st.problem.K.length <= 1) return;
    this.commit();
    this.edit((p) => p.K.splice(i, 1));
  };
  typeItem = (i: number, key: KNumKey, v: number) => {
    this.touch(`k:${i}:${key}`);
    this.edit((p) => (p.K[i][key] = v));
  };
  typeItemName = (i: number, name: string) => {
    this.touch(`k:${i}:name`);
    this.edit((p) => (p.K[i].name = name.slice(0, 20)));
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
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(ROT_MODULE, this.st.title, { problem: this.st.problem }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== ROT_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseRot(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Вращение тела';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
