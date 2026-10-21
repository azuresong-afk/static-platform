/** Состояние вкладки «Удар»: два тела, контакт, вопрос задачи; история отмены, файл проекта. */
import { History } from '../../../shared/history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import type { NoticeData } from '../../../shared/ui/Notice';
import type { After, Before, BodyKind, ImpBody, ImpProblem, Inertia } from '../model/impact';
import { IMP_PRESETS, type ImpPresetKey } from '../presets';

export const IMPACT_MODULE = 'impact';
export const BODY_NUM = ['m', 'J', 'rho', 'L', 'R', 'a', 'b', 'th', 'cx', 'cy', 'ox', 'oy', 'vx', 'vy', 'omega', 'h', 'l', 'ang', 'f', 'c', 'delta'] as const;
export type BodyNumKey = (typeof BODY_NUM)[number];
export const TOP_NUM = ['g', 'px', 'py', 'nAng', 'k', 'tVal'] as const;
export type TopNumKey = (typeof TOP_NUM)[number];
const KINDS: BodyKind[] = ['free', 'axis', 'wall'];
const INERTIAS: Inertia[] = ['point', 'JC', 'rhoC', 'JO', 'rhoO', 'rod', 'disk', 'ring', 'rect', 'sphere'];
const BEFORES: Before[] = ['given', 'fall', 'thread', 'swing'];
const AFTERS: After[] = ['none', 'rise', 'thread', 'slide', 'pivot', 'swing', 'spring', 'pile'];
/** Допустимые варианты для вида тела. */
export const BEFORE_OF: Record<BodyKind, Before[]> = { free: ['given', 'fall', 'thread'], axis: ['given', 'swing'], wall: ['given'] };
export const AFTER_OF: Record<BodyKind, After[]> = {
  free: ['none', 'rise', 'thread', 'slide', 'pivot', 'spring', 'pile'],
  axis: ['none', 'swing'],
  wall: ['none'],
};
export const INERTIA_OF: Record<BodyKind, Inertia[]> = {
  free: ['point', 'sphere', 'disk', 'ring', 'rod', 'rect', 'rhoC', 'JC'],
  axis: ['rod', 'disk', 'ring', 'rect', 'sphere', 'point', 'rhoC', 'JC', 'rhoO', 'JO'],
  wall: ['point'],
};

export interface ImpState {
  problem: ImpProblem;
  title: string;
  preset: ImpPresetKey | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  problem: ImpProblem;
  title: string;
  preset: ImpState['preset'];
}
const copy = (p: ImpProblem): ImpProblem => structuredClone(p);

function parseBodyRaw(raw: unknown): ImpBody | null {
  if (!isObj(raw) || !BODY_NUM.every((k) => isNum(raw[k]))) return null;
  if (
    !KINDS.includes(raw.kind as BodyKind) ||
    !INERTIAS.includes(raw.inertia as Inertia) ||
    !BEFORES.includes(raw.before as Before) ||
    !AFTERS.includes(raw.after as After)
  )
    return null;
  const nums = Object.fromEntries(BODY_NUM.map((k) => [k, raw[k]])) as Record<BodyNumKey, number>;
  return {
    ...nums,
    kind: raw.kind as BodyKind,
    name: typeof raw.name === 'string' ? raw.name.slice(0, 30) : '',
    inertia: raw.inertia as Inertia,
    before: raw.before as Before,
    after: raw.after as After,
  };
}

export function parseImpact(raw: unknown): { ok: true; problem: ImpProblem } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !TOP_NUM.every((k) => isNum(raw[k]))) return { ok: false, errors: ['В файле нет задачи (problem с полями b1, b2, px, py, nAng, k).'] };
  const b1 = parseBodyRaw(raw.b1),
    b2 = parseBodyRaw(raw.b2);
  if (!b1 || !b2) return { ok: false, errors: ['Тело: вид (free, axis, wall), момент инерции, этапы до и после удара и числовые данные.'] };
  if (
    !['smooth', 'rough'].includes(raw.contact as string) ||
    !['after', 'v1', 'k'].includes(raw.ask as string) ||
    !['angle', 'tip', 'height', 'refl'].includes(raw.target as string)
  )
    return { ok: false, errors: ['Контакт (smooth, rough) и вопрос задачи.'] };
  const nums = Object.fromEntries(TOP_NUM.map((k) => [k, raw[k]])) as Record<TopNumKey, number>;
  return {
    ok: true,
    problem: {
      ...nums,
      byWeight: raw.byWeight === true,
      stick: raw.stick === true,
      b1,
      b2,
      contact: raw.contact as ImpProblem['contact'],
      ask: raw.ask as ImpProblem['ask'],
      target: raw.target as ImpProblem['target'],
    },
  };
}

export class ImpStore {
  private st: ImpState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(opts: { preset?: ImpPresetKey; explain?: boolean } = {}) {
    const k = opts.preset ?? 'm4410';
    this.st = {
      problem: copy(IMP_PRESETS[k].problem),
      title: IMP_PRESETS[k].title,
      preset: k,
      canUndo: false,
      canRedo: false,
      notice: null,
      explain: opts.explain ?? true,
    };
  }
  get = (): ImpState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<ImpState>) {
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
  private edit(fn: (p: ImpProblem) => void) {
    const p = copy(this.st.problem);
    fn(p);
    this.set({ problem: p });
  }
  private body = (p: ImpProblem, i: number) => (i === 0 ? p.b1 : p.b2);
  loadPreset = (k: ImpPresetKey) => {
    this.commit();
    this.set({ problem: copy(IMP_PRESETS[k].problem), title: IMP_PRESETS[k].title, preset: k });
  };
  typeTop = (key: TopNumKey, v: number) => {
    this.touch(`t:${key}`);
    this.edit((p) => (p[key] = v));
  };
  setFlag = (key: 'byWeight' | 'stick', on: boolean) => {
    this.commit();
    this.edit((p) => {
      p[key] = on;
      if (key === 'stick' && on) p.k = 0;
    });
  };
  setContact = (c: ImpProblem['contact']) => {
    this.commit();
    this.edit((p) => {
      p.contact = c;
      if (c === 'rough') p.k = 0;
    });
  };
  setAsk = (a: ImpProblem['ask']) => {
    if (a === this.st.problem.ask) return;
    this.commit();
    this.edit((p) => {
      p.ask = a;
      if (a === 'v1' && p.target !== 'angle' && p.target !== 'tip') p.target = 'angle';
      if (a === 'k' && p.target !== 'height' && p.target !== 'refl') p.target = 'height';
    });
  };
  setTarget = (t: ImpProblem['target']) => {
    this.commit();
    this.edit((p) => (p.target = t));
  };
  typeBody = (i: number, key: BodyNumKey, v: number) => {
    this.touch(`b${i}:${key}`);
    this.edit((p) => (this.body(p, i)[key] = v));
  };
  typeBodyName = (i: number, s: string) => {
    this.touch(`b${i}:name`);
    this.edit((p) => (this.body(p, i).name = s.slice(0, 30)));
  };
  setKind = (i: number, kind: BodyKind) => {
    this.commit();
    this.edit((p) => {
      const b = this.body(p, i);
      b.kind = kind;
      if (!INERTIA_OF[kind].includes(b.inertia)) b.inertia = INERTIA_OF[kind][0];
      if (!BEFORE_OF[kind].includes(b.before)) b.before = 'given';
      if (!AFTER_OF[kind].includes(b.after)) b.after = 'none';
    });
  };
  setInertia = (i: number, v: Inertia) => {
    this.commit();
    this.edit((p) => (this.body(p, i).inertia = v));
  };
  setBefore = (i: number, v: Before) => {
    this.commit();
    this.edit((p) => (this.body(p, i).before = v));
  };
  setAfter = (i: number, v: After) => {
    this.commit();
    this.edit((p) => (this.body(p, i).after = v));
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
    text: writeEnvelope(IMPACT_MODULE, this.st.title, { problem: this.st.problem }, now),
  });
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    if (env.module !== IMPACT_MODULE) return (this.notify(head + 'это файл другого раздела.', 'bad'), false);
    const r = parseImpact(env.raw.problem);
    if (!r.ok) return (this.notify(head + r.errors.slice(0, 4).join(' '), 'bad'), false);
    this.commit();
    const title = env.title ?? 'Удар';
    this.set({ problem: r.problem, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}
