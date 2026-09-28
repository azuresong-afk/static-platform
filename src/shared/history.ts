/**
 * История отмены для любого модуля: снимки состояния до каждого изменения.
 * Правки одного поля подряд — одна запись (сессия правки до потери фокуса).
 */
export class History<T> {
  private u: T[] = [];
  private r: T[] = [];
  private session: string | null = null;

  constructor(private readonly max = 300) {}

  get canUndo(): boolean {
    return this.u.length > 0;
  }
  get canRedo(): boolean {
    return this.r.length > 0;
  }

  /** Запомнить состояние перед изменением; повтор после этого недоступен. */
  push(snap: T) {
    this.u.push(snap);
    if (this.u.length > this.max) this.u.shift();
    this.r = [];
  }

  /** Начать сессию правки поля key; true — это новая сессия, и нужна запись истории. */
  startSession(key: string): boolean {
    if (this.session === key) return false;
    this.session = key;
    return true;
  }
  /** Поле потеряло фокус — следующая правка в нём будет новой записью. */
  endSession(key: string) {
    if (this.session === key) this.session = null;
  }

  /** Шаг назад: вернуть снимок для восстановления (текущий уходит в повтор) или undefined. */
  undo(current: T): T | undefined {
    const prev = this.u.pop();
    if (prev === undefined) return undefined;
    this.r.push(current);
    this.session = null;
    return prev;
  }
  redo(current: T): T | undefined {
    const next = this.r.pop();
    if (next === undefined) return undefined;
    this.u.push(current);
    this.session = null;
    return next;
  }
}
