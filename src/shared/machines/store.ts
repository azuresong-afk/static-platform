/**
 * Состояние режима «машины» вкладки: выбранная задача каталога и её числа; история отмены, файл проекта.
 * Режим включается переключателем вкладки; пока он включён, отмена, файлы и уведомления идут в это состояние
 * (modeStore), иначе — в основное состояние вкладки.
 */
import type { ModuleStore } from '../../app/module';
import { History } from '../history';
import { isNum, isObj, projectFileName, readEnvelope, writeEnvelope } from '../projectFile';
import type { NoticeData } from '../ui/Notice';
import { defaults, type Catalog, type Vals } from './types';

export interface MachineState {
  /** Режим включён: вкладка показывает каталог. */
  active: boolean;
  id: string;
  vals: Vals;
  title: string;
  preset: string | 'custom';
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
interface Snap {
  id: string;
  vals: Vals;
  title: string;
  preset: string;
}

export class MachineStore {
  private st: MachineState;
  private listeners = new Set<() => void>();
  private hist = new History<Snap>();
  constructor(
    readonly cat: Catalog,
    opts: { explain?: boolean } = {},
  ) {
    const p = cat.presets[cat.start];
    this.st = {
      active: false,
      id: p.machine,
      vals: this.valsOf(cat.start),
      title: p.title,
      preset: cat.start,
      canUndo: false,
      canRedo: false,
      notice: null,
      explain: opts.explain ?? true,
    };
  }
  private machine = (id: string) => this.cat.machines.find((m) => m.id === id)!;
  private valsOf(key: string): Vals {
    const p = this.cat.presets[key];
    return { ...defaults(this.machine(p.machine)), ...p.vals };
  }
  get = (): MachineState => this.st;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<MachineState>) {
    this.st = { ...this.st, ...patch, canUndo: this.hist.canUndo, canRedo: this.hist.canRedo };
    this.listeners.forEach((f) => f());
  }
  private snap = (): Snap => ({ id: this.st.id, vals: this.st.vals, title: this.st.title, preset: this.st.preset });
  private commit() {
    this.hist.push(this.snap());
    if (this.st.preset !== 'custom') this.st = { ...this.st, preset: 'custom', title: 'Своя задача' };
  }
  private touch(key: string) {
    if (this.hist.startSession(key)) this.commit();
  }
  endSession = (key: string) => this.hist.endSession(key);
  setActive = (active: boolean) => {
    if (active !== this.st.active) this.set({ active });
  };
  loadPreset = (key: string) => {
    if (!(key in this.cat.presets)) return;
    this.commit();
    this.set({ active: true, id: this.cat.presets[key].machine, vals: this.valsOf(key), title: this.cat.presets[key].title, preset: key });
  };
  /** Другой тип задачи: числа — по умолчанию. */
  selectMachine = (id: string) => {
    if (id === this.st.id || !this.cat.machines.some((m) => m.id === id)) return;
    this.commit();
    this.set({ id, vals: defaults(this.machine(id)) });
  };
  type = (k: string, v: number) => {
    this.touch('v:' + k);
    this.set({ vals: { ...this.st.vals, [k]: v } });
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
    text: writeEnvelope(this.cat.moduleId, this.st.title, { machine: { id: this.st.id, vals: this.st.vals } }, now),
  });
  /** Данные режима из файла; false, если в них нет задачи каталога. */
  parse = (raw: unknown): { id: string; vals: Vals } | string => {
    if (!isObj(raw)) return 'В файле нет задачи (machine с полями id и vals).';
    const m = this.cat.machines.find((x) => x.id === raw.id);
    if (!m || !isObj(raw.vals)) return 'Неизвестный тип задачи в файле.';
    const vals = defaults(m);
    for (const p of m.params) {
      const x = (raw.vals as Record<string, unknown>)[p.k];
      if (x === undefined) continue;
      if (!isNum(x)) return `Число «${p.label}» в файле неверное.`;
      vals[p.k] = x;
    }
    return { id: m.id, vals };
  };
  importProject = (text: string, fileName?: string): boolean => {
    const head = fileName ? `Не удалось открыть «${fileName}»: ` : 'Не удалось открыть файл: ';
    const env = readEnvelope(text);
    if (!env.ok) return (this.notify(head + env.errors.join(' '), 'bad'), false);
    const r = this.parse(env.raw.machine);
    if (typeof r === 'string') return (this.notify(head + r, 'bad'), false);
    this.commit();
    const title = env.title ?? this.cat.modeName;
    this.set({ active: true, id: r.id, vals: r.vals, title, preset: 'custom' });
    this.notify(`Открыт проект «${title}».`, 'ok');
    return true;
  };
}

/**
 * Хранилище вкладки с режимом «машины»: пока режим включён, отмена, файл и уведомления — у MachineStore;
 * файл с данными каталога (поле machine) открывается всегда в режиме «машины».
 */
export function modeStore(base: ModuleStore, ms: MachineStore): ModuleStore {
  const on = () => ms.get().active;
  return {
    undo: () => (on() ? ms.undo() : base.undo()),
    redo: () => (on() ? ms.redo() : base.redo()),
    exportProject: (now) => (on() ? ms.exportProject(now) : base.exportProject(now)),
    importProject: (text, name) => {
      const env = readEnvelope(text);
      if (env.ok && env.module === ms.cat.moduleId && isObj(env.raw.machine)) return ms.importProject(text, name);
      ms.setActive(false);
      return base.importProject(text, name);
    },
    notify: (t, tone) => (on() ? ms.notify(t, tone) : base.notify(t, tone)),
    projectTitle: () => (on() ? ms.projectTitle() : base.projectTitle()),
  };
}
