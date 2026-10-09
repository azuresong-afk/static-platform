/** Состояние вкладки «Удар и колебания»: задача, отмена и повтор, готовые задачи, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import { BEAM_SCHEMES, newElem, type BeamScheme, type Elem, type ElemKind, type Stage } from '../model/elastic';
import type { DampMode, ForceMode, ForceUnit, InitMode, LenUnit, OscProblem, Orient, StiffMode } from '../model/osc';
import { OSC_BASE, OSC_PRESETS, type OscPresetKey } from '../presets';

export const OSC_MODULE = 'oscillation';
const MAX_STAGES = 4,
  MAX_ITEMS = 4;

export type TopNum = 'm' | 'alpha' | 'Q' | 't' | 'gms';
export type ElNum = 'c' | 'dst' | 'T0' | 'mEl' | 'W' | 'sAllow';
export type DampNum = 'b' | 'n' | 'q' | 'N' | 'T1' | 'f' | 'f0';
export type ExcNum = 'H' | 'm0' | 'e' | 'a' | 'p' | 'delta';
export type InitNum = 'x0' | 'lambda0' | 'Fprev' | 'h' | 'v0';
export type ElemNum = 'c' | 'ang' | 'la' | 'lb' | 'E' | 'l' | 'A' | 'J' | 'a';

export interface OscState {
  problem: OscProblem;
  title: string;
  preset: OscPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: OscProblem;
  title: string;
  preset: OscState['preset'];
}
const copy = (p: OscProblem): OscProblem => structuredClone(p);

const pick = <T extends string>(v: unknown, allowed: readonly T[], def: T): T => (allowed.includes(v as T) ? (v as T) : def);
const num = (o: Record<string, unknown>, k: string, def: number, e: string[], where: string): number => {
  const v = o[k];
  if (v === undefined) return def;
  if (!isNum(v)) {
    e.push(`${where}: поле ${k} — не число.`);
    return def;
  }
  return v;
};

function parseElem(raw: unknown, e: string[], where: string): Elem {
  const d = newElem('spring');
  if (!isObj(raw)) {
    e.push(`${where}: нет данных элемента.`);
    return d;
  }
  const kind = pick<ElemKind>(raw.kind, ['spring', 'rod', 'beam'], 'spring');
  const out: Elem = {
    ...newElem(kind),
    scheme: pick<BeamScheme>(
      raw.scheme,
      BEAM_SCHEMES.map((s) => s.id),
      'ss-mid',
    ),
  };
  for (const k of ['c', 'ang', 'la', 'lb', 'E', 'l', 'A', 'J', 'a'] as const) out[k] = num(raw, k, out[k], e, where);
  return out;
}

export function parseOsc(raw: unknown): { ok: true; problem: OscProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !isObj(raw.el) || !isObj(raw.damp) || !isObj(raw.exc) || !isObj(raw.init))
    return { ok: false, errors: ['В файле нет задачи (problem с полями el, damp, exc, init).'] };
  const e: string[] = [];
  const b = OSC_BASE;
  const el = raw.el,
    dm = raw.damp,
    ex = raw.exc,
    ini = raw.init;
  const stages: Stage[] = Array.isArray(el.stages)
    ? el.stages.slice(0, MAX_STAGES).map((s: unknown, i) => ({
        items:
          isObj(s) && Array.isArray(s.items) && s.items.length
            ? s.items.slice(0, MAX_ITEMS).map((it: unknown, j) => parseElem(it, e, `Ступень ${i + 1}, элемент ${j + 1}`))
            : (e.push(`Ступень ${i + 1}: нет элементов.`), []),
      }))
    : structuredClone(b.el.stages);
  if (!stages.length) e.push('Нет ни одной ступени упругого элемента.');
  const p: OscProblem = {
    len: pick<LenUnit>(raw.len, ['m', 'cm', 'mm'], b.len),
    force: pick<ForceUnit>(raw.force, ['N', 'kN', 'kG', 'G', 't'], b.force),
    gms: num(raw, 'gms', b.gms, e, 'Задача'),
    byWeight: raw.byWeight !== false,
    m: num(raw, 'm', b.m, e, 'Задача'),
    orient: pick<Orient>(raw.orient, ['h', 'v', 'incl'], b.orient),
    alpha: num(raw, 'alpha', b.alpha, e, 'Задача'),
    Q: num(raw, 'Q', b.Q, e, 'Задача'),
    el: {
      mode: pick<StiffMode>(el.mode, ['c', 'static', 'period', 'elems'], b.el.mode),
      c: num(el, 'c', b.el.c, e, 'Упругий элемент'),
      dst: num(el, 'dst', b.el.dst, e, 'Упругий элемент'),
      T0: num(el, 'T0', b.el.T0, e, 'Упругий элемент'),
      T0damped: el.T0damped === true,
      stages,
      rope: el.rope === true,
      mEl: num(el, 'mEl', 0, e, 'Упругий элемент'),
      W: num(el, 'W', 0, e, 'Упругий элемент'),
      sAllow: num(el, 'sAllow', 0, e, 'Упругий элемент'),
    },
    damp: {
      mode: pick<DampMode>(dm.mode, ['none', 'b', 'n', 'ratio', 'T1', 'dry'], b.damp.mode),
      ...(Object.fromEntries((['b', 'n', 'q', 'N', 'T1', 'f', 'f0'] as const).map((k) => [k, num(dm, k, b.damp[k], e, 'Сопротивление')])) as Record<
        DampNum,
        number
      >),
    },
    exc: {
      mode: pick<ForceMode>(ex.mode, ['none', 'H', 'rotor', 'base'], b.exc.mode),
      ...(Object.fromEntries((['H', 'm0', 'e', 'a', 'p', 'delta'] as const).map((k) => [k, num(ex, k, b.exc[k], e, 'Возмущение')])) as Record<ExcNum, number>),
    },
    init: {
      mode: pick<InitMode>(ini.mode, ['eq', 'lambda', 'load', 'drop'], b.init.mode),
      ...(Object.fromEntries((['x0', 'lambda0', 'Fprev', 'h', 'v0'] as const).map((k) => [k, num(ini, k, b.init[k], e, 'Начальные условия')])) as Record<
        InitNum,
        number
      >),
    },
    t: num(raw, 't', 0, e, 'Задача'),
  };
  if (e.length) return { ok: false, errors: e };
  return { ok: true, problem: p };
}

export class OscStore {
  private st: OscState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: OscPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm324';
    this.st = {
      problem: copy(OSC_PRESETS[k].problem),
      title: OSC_PRESETS[k].title,
      preset: k,
      canUndo: false,
      canRedo: false,
      notice: null,
      explain: opts.explain ?? true,
    };
  }
  get = (): OscState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<OscState>) {
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
  private edit(fn: (p: OscProblem) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  private change(fn: (p: OscProblem) => void) {
    this.commit();
    this.edit(fn);
  }
  loadPreset = (k: OscPresetKey) => {
    this.commit();
    this.set({ problem: copy(OSC_PRESETS[k].problem), title: OSC_PRESETS[k].title, preset: k });
  };
  /* Числа. */
  typeTop = (k: TopNum, v: number) => {
    this.touch(`top:${k}`);
    this.edit((p) => (p[k] = v));
  };
  typeEl = (k: ElNum, v: number) => {
    this.touch(`el:${k}`);
    this.edit((p) => (p.el[k] = v));
  };
  typeDamp = (k: DampNum, v: number) => {
    this.touch(`damp:${k}`);
    this.edit((p) => (p.damp[k] = v));
  };
  typeExc = (k: ExcNum, v: number) => {
    this.touch(`exc:${k}`);
    this.edit((p) => (p.exc[k] = v));
  };
  typeInit = (k: InitNum, v: number) => {
    this.touch(`init:${k}`);
    this.edit((p) => (p.init[k] = v));
  };
  typeElem = (i: number, j: number, k: ElemNum, v: number) => {
    this.touch(`elem:${i}:${j}:${k}`);
    this.edit((p) => (p.el.stages[i].items[j][k] = v));
  };
  /* Выбор. */
  setUnits = (len: LenUnit, force: ForceUnit) => this.change((p) => ((p.len = len), (p.force = force)));
  setByWeight = (on: boolean) => this.change((p) => (p.byWeight = on));
  setOrient = (o: Orient) => this.change((p) => (p.orient = o));
  setStiffMode = (m: StiffMode) => this.change((p) => (p.el.mode = m));
  setT0damped = (on: boolean) => this.change((p) => (p.el.T0damped = on));
  setRope = (on: boolean) => this.change((p) => (p.el.rope = on));
  setDampMode = (m: DampMode) => this.change((p) => (p.damp.mode = m));
  setExcMode = (m: ForceMode) => this.change((p) => (p.exc.mode = m));
  setInitMode = (m: InitMode) => this.change((p) => (p.init.mode = m));
  /* Упругие элементы. */
  addStage = () => {
    if (this.st.problem.el.stages.length >= MAX_STAGES) return;
    this.change((p) => p.el.stages.push({ items: [newElem('spring')] }));
  };
  removeStage = (i: number) => {
    if (this.st.problem.el.stages.length <= 1) return;
    this.change((p) => p.el.stages.splice(i, 1));
  };
  addElem = (i: number) => {
    if (this.st.problem.el.stages[i].items.length >= MAX_ITEMS) return;
    this.change((p) => p.el.stages[i].items.push(newElem('spring')));
  };
  removeElem = (i: number, j: number) => {
    const s = this.st.problem.el.stages;
    if (s[i].items.length <= 1) return this.removeStage(i);
    this.change((p) => p.el.stages[i].items.splice(j, 1));
  };
  setElemKind = (i: number, j: number, kind: ElemKind) =>
    this.change((p) => {
      const old = p.el.stages[i].items[j];
      p.el.stages[i].items[j] = {
        ...newElem(kind),
        E: kind === old.kind || old.kind === 'spring' ? newElem(kind).E : old.E,
        l: old.kind === 'spring' ? newElem(kind).l : old.l,
      };
    });
  setScheme = (i: number, j: number, s: BeamScheme) => this.change((p) => (p.el.stages[i].items[j].scheme = s));
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
    text: writeEnvelope(OSC_MODULE, this.st.title, { problem: this.st.problem }, now),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== OSC_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseOsc(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Удар и колебания';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
