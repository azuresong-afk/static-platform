/** Общая история отмены (src/shared/history.ts). */
import { describe, expect, it } from 'vitest';
import { History } from '../src/shared/history';

describe('History', () => {
  it('отмена и повтор возвращают снимки по порядку; новое изменение сбрасывает повтор', () => {
    const h = new History<number>();
    expect(h.canUndo).toBe(false);
    h.push(0);
    h.push(1);
    expect(h.undo(2)).toBe(1);
    expect(h.undo(1)).toBe(0);
    expect(h.undo(0)).toBeUndefined();
    expect(h.canRedo).toBe(true);
    expect(h.redo(0)).toBe(1);
    h.push(1);
    expect(h.canRedo).toBe(false);
  });

  it('правки одного поля подряд — одна запись; после потери фокуса или отмены — новая', () => {
    const h = new History<string>();
    expect(h.startSession('a')).toBe(true);
    expect(h.startSession('a')).toBe(false);
    expect(h.startSession('b')).toBe(true);
    h.endSession('a');
    expect(h.startSession('b')).toBe(false);
    h.endSession('b');
    expect(h.startSession('b')).toBe(true);
    h.push('x');
    h.undo('y');
    expect(h.startSession('b')).toBe(true);
  });

  it('не больше max записей: самые старые отбрасываются', () => {
    const h = new History<number>(3);
    for (let i = 0; i < 5; i++) h.push(i);
    expect([h.undo(9), h.undo(9), h.undo(9), h.undo(9)]).toEqual([4, 3, 2, undefined]);
  });
});
