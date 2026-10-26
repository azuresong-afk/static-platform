/** Состояние вкладки «Уравнения Лагранжа»: задача, история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { LagBody, LagCoord, LagParam, LagProblem, LagProgram } from '../model/lagrange';
import { LAGRANGE_PRESETS, type LagrangePresetKey } from '../presets';

export const LAGRANGE_MODULE = 'lagrange';
const MAX_COORDS = 3,
  MAX_PARAMS = 12;

export interface LagrangeState {
  problem: LagProblem;
  title: string;
  preset: LagrangePresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: LagProblem;
  title: string;
  preset: LagrangeState['preset'];
}

const isStr = (x: unknown): x is string => typeof x === 'string';

export function parseProblem(raw: unknown): { ok: true; problem: LagProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw)) return { ok: false, errors: ['В файле нет задачи (problem).'] };
  const errors: string[] = [];
  const coords: LagCoord[] = [];
  if (!Array.isArray(raw.coords) || !raw.coords.length || raw.coords.length > MAX_COORDS) errors.push(`Координат должно быть от 1 до ${MAX_COORDS}.`);
  else
    raw.coords.forEach((c: unknown, i: number) => {
      if (!isObj(c) || !isStr(c.name) || !isNum(c.q0) || !isNum(c.v0) || !isNum(c.eq) || !isStr(c.Q)) errors.push(`Координата №${i + 1}: имя, q0, v0, eq — числа, Q — формула.`);
      else coords.push({ name: c.name, q0: c.q0, v0: c.v0, eq: c.eq, Q: c.Q });
    });
  const params: LagParam[] = [];
  if (!Array.isArray(raw.params) || raw.params.length > MAX_PARAMS) errors.push(`Параметров — не больше ${MAX_PARAMS}.`);
  else
    raw.params.forEach((p: unknown, i: number) => {
      if (!isObj(p) || !isStr(p.name) || !isNum(p.value)) errors.push(`Параметр №${i + 1}: имя и числовое значение.`);
      else params.push({ name: p.name, value: p.value });
    });
  if (!isStr(raw.T) || !isStr(raw.P)) errors.push('T и Π — формулы (строки).');
  if (!isNum(raw.tEnd) || raw.tEnd < 0) errors.push('Время интегрирования — неотрицательное число.');
  if (errors.length) return { ok: false, errors };
  const es = raw.eqSearch;
  if (es != null && !(isObj(es) && isNum(es.from) && isNum(es.to) && es.to > es.from)) return { ok: false, errors: ['Поиск равновесия: отрезок from < to.'] };
  const iv = raw.inverse;
  if (iv != null && !(isObj(iv) && isStr(iv.param) && isNum(iv.from) && isNum(iv.to) && iv.to > iv.from)) return { ok: false, errors: ['Параметр по положению равновесия: имя параметра и отрезок from < to.'] };
  const bd = raw.body;
  let body: LagBody | null = null;
  if (bd != null) {
    const keys = ['m', 'x', 'y', 'dir', 'angle', 'from'] as const;
    if (!isObj(bd) || keys.some((k) => !isStr(bd[k])) || !['none', 'e', 'n'].includes(bd.sep as string) || typeof bd.flight !== 'boolean')
      return { ok: false, errors: ['Реакция тела: масса, координаты центра масс, оси — формулы; отрыв — none, e или n.'] };
    body = {
      m: bd.m as string,
      x: bd.x as string,
      y: bd.y as string,
      dir: bd.dir as string,
      angle: bd.angle as string,
      from: bd.from as string,
      sep: bd.sep as LagBody['sep'],
      flight: bd.flight,
    };
  }
  if (raw.stop != null && !isStr(raw.stop)) return { ok: false, errors: ['Значение координаты для остановки — формула.'] };
  const pg = raw.program;
  let program: LagProgram | null = null;
  if (pg != null) {
    if (!isObj(pg) || !Array.isArray(pg.laws) || pg.laws.length !== coords.length || !pg.laws.every(isStr) || !isStr(pg.at))
      return { ok: false, errors: ['Программное движение: по закону на каждую координату и момент времени.'] };
    program = { laws: pg.laws as string[], at: pg.at };
  }
  return {
    ok: true,
    problem: {
      coords,
      params,
      T: raw.T as string,
      P: raw.P as string,
      tEnd: raw.tEnd as number,
      ...(isObj(es) ? { eqSearch: { from: es.from as number, to: es.to as number } } : {}),
      ...(isObj(iv) ? { inverse: { param: iv.param as string, from: iv.from as number, to: iv.to as number } } : {}),
      ...(body ? { body } : {}),
      ...(isStr(raw.stop) ? { stop: raw.stop } : {}),
      ...(program ? { program } : {}),
    },
  };
}

export class LagrangeStore {
  private st: LagrangeState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: LagrangePresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm4837';
    this.st = { problem: structuredClone(LAGRANGE_PRESETS[k].problem), title: LAGRANGE_PRESETS[k].title, preset: k, canUndo: false, canRedo: false, notice: null, explain: opts.explain ?? true };
  }
  get = (): LagrangeState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<LagrangeState>) {
    this.st = { ...this.st, ...patch, canUndo: this.hist.canUndo, canRedo: this.hist.canRedo };
    this.listeners.forEach((f) => f());
  }
  private snap = (): Snap => ({ problem: this.st.problem, title: this.st.title, preset: this.st.preset });
  private commit() {
    this.hist.push(this.snap());
    if (this.st.preset !== 'custom') this.st = { ...this.st, preset: 'custom', title: 'Своя система' };
  }
  private touch(key: string) {
    if (this.hist.startSession(key)) this.commit();
  }
  endSession = (key: string) => this.hist.endSession(key);
  private setProblem(problem: LagProblem) {
    this.set({ problem });
  }
  loadPreset = (k: LagrangePresetKey) => {
    this.commit();
    this.set({ problem: structuredClone(LAGRANGE_PRESETS[k].problem), title: LAGRANGE_PRESETS[k].title, preset: k });
  };
  typeText = (key: 'T' | 'P', v: string) => {
    this.touch(key);
    this.setProblem({ ...this.st.problem, [key]: v });
  };
  /** Поиск положений равновесия (отрезок по умолчанию — от −π до π: для угла один оборот). */
  setEqSearch = (on: boolean) => {
    if (on === !!this.st.problem.eqSearch) return;
    this.commit();
    this.setProblem({ ...this.st.problem, eqSearch: on ? { from: -3.1415, to: 3.1416 } : null, ...(on ? {} : { inverse: null }) });
  };
  /** Обратная задача: параметр по заданному положению равновесия q* (нужен поиск равновесия). */
  setInverse = (on: boolean) => {
    const p = this.st.problem;
    if (on === !!p.inverse) return;
    this.commit();
    const last = p.params[p.params.length - 1]?.name ?? 'ω';
    this.setProblem({ ...p, eqSearch: p.eqSearch ?? { from: -3.1415, to: 3.1416 }, inverse: on ? { param: last, from: 0, to: 100 } : null });
  };
  typeInverse = <K extends 'param' | 'from' | 'to'>(key: K, v: K extends 'param' ? string : number) => {
    const iv = this.st.problem.inverse;
    if (!iv) return;
    this.touch(`inv:${key}`);
    this.setProblem({ ...this.st.problem, inverse: { ...iv, [key]: v } });
  };
  typeEqRange = (key: 'from' | 'to', v: number) => {
    const es = this.st.problem.eqSearch;
    if (!es) return;
    this.touch(`eq:${key}`);
    this.setProblem({ ...this.st.problem, eqSearch: { ...es, [key]: v } });
  };
  /** Реакция связей на тело и отрыв (§43). */
  setBody = (on: boolean) => {
    if (on === !!this.st.problem.body) return;
    this.commit();
    this.setProblem({ ...this.st.problem, body: on ? { m: 'm', x: '0', y: '0', dir: '', angle: '', from: '', sep: 'none', flight: false } : null });
  };
  typeBody = <K extends 'm' | 'x' | 'y' | 'dir' | 'angle' | 'from'>(key: K, v: string) => {
    const bd = this.st.problem.body;
    if (!bd) return;
    this.touch(`body:${key}`);
    this.setProblem({ ...this.st.problem, body: { ...bd, [key]: v } });
  };
  setBodyChoice = <K extends 'sep' | 'flight'>(key: K, v: LagBody[K]) => {
    const bd = this.st.problem.body;
    if (!bd || bd[key] === v) return;
    this.commit();
    this.setProblem({ ...this.st.problem, body: { ...bd, [key]: v } });
  };
  setStop = (on: boolean) => {
    if (on === (this.st.problem.stop != null)) return;
    this.commit();
    this.setProblem({ ...this.st.problem, stop: on ? '0' : null });
  };
  typeStop = (v: string) => {
    if (this.st.problem.stop == null) return;
    this.touch('stop');
    this.setProblem({ ...this.st.problem, stop: v });
  };
  /** Программное движение (Д.20). */
  setProgram = (on: boolean) => {
    if (on === !!this.st.problem.program) return;
    this.commit();
    this.setProblem({ ...this.st.problem, program: on ? { laws: this.st.problem.coords.map(() => '0'), at: '0' } : null });
  };
  typeLaw = (i: number, v: string) => {
    const pg = this.st.problem.program;
    if (!pg) return;
    this.touch(`law:${i}`);
    this.setProblem({ ...this.st.problem, program: { ...pg, laws: pg.laws.map((x, j) => (j === i ? v : x)) } });
  };
  typeAt = (v: string) => {
    const pg = this.st.problem.program;
    if (!pg) return;
    this.touch('law:at');
    this.setProblem({ ...this.st.problem, program: { ...pg, at: v } });
  };
  typeTime = (v: number) => {
    this.touch('tEnd');
    this.setProblem({ ...this.st.problem, tEnd: v });
  };
  typeCoord = <K extends keyof LagCoord>(i: number, key: K, v: LagCoord[K]) => {
    this.touch(`coord:${i}:${key}`);
    this.setProblem({ ...this.st.problem, coords: this.st.problem.coords.map((c, j) => (j === i ? { ...c, [key]: v } : c)) });
  };
  typeParam = <K extends keyof LagParam>(i: number, key: K, v: LagParam[K]) => {
    this.touch(`param:${i}:${key}`);
    this.setProblem({ ...this.st.problem, params: this.st.problem.params.map((c, j) => (j === i ? { ...c, [key]: v } : c)) });
  };
  addCoord = () => {
    const p = this.st.problem;
    if (p.coords.length >= MAX_COORDS) return;
    this.commit();
    const used = new Set([...p.coords.map((c) => c.name), ...p.params.map((c) => c.name)]);
    const name = ['q', 'ψ', 'y', 'z', 's', 'θ'].find((n) => !used.has(n)) ?? 'q' + (p.coords.length + 1);
    this.setProblem({ ...p, coords: [...p.coords, { name, q0: 0, v0: 0, eq: 0, Q: '' }], ...(p.program ? { program: { ...p.program, laws: [...p.program.laws, '0'] } } : {}) });
  };
  removeCoord = (i: number) => {
    const p = this.st.problem;
    if (p.coords.length <= 1) return;
    this.commit();
    this.setProblem({ ...p, coords: p.coords.filter((_, j) => j !== i), ...(p.program ? { program: { ...p.program, laws: p.program.laws.filter((_, j) => j !== i) } } : {}) });
  };
  addParam = () => {
    const p = this.st.problem;
    if (p.params.length >= MAX_PARAMS) return;
    this.commit();
    const used = new Set([...p.coords.map((c) => c.name), ...p.params.map((c) => c.name)]);
    const name = ['k', 'c', 'b', 'R', 'J', 'a', 'h', 'F'].find((n) => !used.has(n)) ?? 'p' + (p.params.length + 1);
    this.setProblem({ ...p, params: [...p.params, { name, value: 1 }] });
  };
  removeParam = (i: number) => {
    this.commit();
    this.setProblem({ ...this.st.problem, params: this.st.problem.params.filter((_, j) => j !== i) });
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
  exportProject = (now = new Date()) => ({ name: projectFileName(this.st.title, now), text: writeEnvelope(LAGRANGE_MODULE, this.st.title, { problem: this.st.problem }, now) });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== LAGRANGE_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseProblem(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Уравнения Лагранжа';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
