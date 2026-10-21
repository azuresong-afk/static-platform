/**
 * Второй экран раздела («задачи-расширения», src/shared/extra.ts) поверх состояния раздела (пункт 28).
 * Состояние раздела хранит ExtraProblem и выбранный экран; этот переходник даёт экрану ExtraScreen методы правки
 * с отменой: сессии ввода ключом `x:<поле>`, выбор вопроса и списков — отдельными шагами.
 */
import { extraProblem, findAsk, parseExtra, type AskDef, type ExtraProblem } from './extra';
import type { ExtraHost, ExtraHostState } from './ui/ExtraScreen';

export type XView = 'main' | 'extra';

/** Что переходник берёт у состояния раздела (методы есть у всех хранилищ разделов). */
export interface ExtraCore {
  get(): ExtraHostState & { view: XView };
  subscribe(fn: () => void): () => void;
  endSession(k: string): void;
  undo(): void;
  redo(): void;
  loadPreset(k: never): void;
  closeNotice(): void;
  setExplain(on: boolean): void;
}
/** Закрытые методы хранилища, которые переходник вызывает. */
export interface ExtraOps {
  commit(): void;
  touch(k: string): void;
  patch(p: { extra?: ExtraProblem; view?: XView }): void;
}

export function extraHost(asks: AskDef[], s: ExtraCore, ops: ExtraOps): ExtraHost {
  const edit = (fn: (x: ExtraProblem) => void) => {
    const x = structuredClone(s.get().extra);
    fn(x);
    ops.patch({ extra: x });
  };
  return {
    get: () => s.get(),
    subscribe: (fn) => s.subscribe(fn),
    setXAsk: (id) => {
      ops.commit();
      ops.patch({ extra: extraProblem(findAsk(asks, id)) });
    },
    typeNum: (k, v) => {
      ops.touch(`x:${k}`);
      edit((x) => (x.n[k] = v));
    },
    typeText: (k, t) => {
      ops.touch(`x:${k}`);
      edit((x) => (x.s[k] = t.slice(0, 300)));
    },
    pick: (k, v) => {
      ops.commit();
      edit((x) => (x.s[k] = v));
    },
    endSession: (k) => s.endSession(k),
    undo: () => s.undo(),
    redo: () => s.redo(),
    loadPreset: (k) => s.loadPreset(k as never),
    setView: (v) => {
      if (v !== s.get().view) ops.patch({ view: v });
    },
    closeNotice: () => s.closeNotice(),
    setExplain: (on) => s.setExplain(on),
  };
}

/** Файл проекта: второй экран и какой экран открыт (`ok` — основной экран прочитан). */
export function readExtraView(raw: Record<string, unknown>, asks: AskDef[], ok: boolean): { extra: ExtraProblem | null; view: XView; usable: boolean } {
  const extra = parseExtra(raw.extra, asks);
  const view: XView = raw.view === 'extra' && extra ? 'extra' : 'main';
  return { extra, view, usable: ok || view === 'extra' };
}
