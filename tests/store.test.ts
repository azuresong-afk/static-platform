/** Состояние интерфейса и история отмены. */
import { describe, expect, it } from 'vitest';
import { geom } from '../src/model/geometry';
import { Store } from '../src/ui/store';

describe('история', () => {
  it('отменить и повторить; после изменения повтор недоступен', () => {
    const st = new Store();
    const s0 = st.get().s;
    expect(st.get().canUndo).toBe(false);
    st.addItem('force');
    const s1 = st.get().s;
    expect(s1.items.length).toBe(s0.items.length + 1);
    expect(st.get().preset).toBe('custom');
    st.undo();
    expect(st.get().s).toEqual(s0);
    expect(st.get().preset).toBe('simple');
    expect(st.get().canRedo).toBe(true);
    st.redo();
    expect(st.get().s).toEqual(s1);
    st.undo();
    st.addItem('weight');
    expect(st.get().canRedo).toBe(false);
  });

  it('ввод в одно поле — одна запись истории; новая сессия после потери фокуса', () => {
    const st = new Store();
    const F = st.get().s.items.find((i) => i.type === 'force')!;
    const s0 = st.get().s;
    st.typeItemField(F.id, 'F', 1);
    st.typeItemField(F.id, 'F', 12);
    st.typeItemField(F.id, 'F', 125);
    st.undo();
    expect(st.get().s).toEqual(s0);
    st.redo();
    st.endSession('item:' + F.id + ':F');
    st.typeItemField(F.id, 'F', 7);
    st.undo();
    expect((st.get().s.items.find((i) => i.id === F.id) as { F: number }).F).toBe(125);
  });

  it('длина участка: неверные значения не применяются и не пишутся в историю', () => {
    const st = new Store({ preset: 'gframe' });
    const cant = st.get().s.segs.at(-1)!;
    expect(st.typeSegLen(cant.id, 0)).toBe(false);
    expect(st.get().canUndo).toBe(false);
    expect(st.typeSegLen(cant.id, 5)).toBe(true);
    expect(st.get().s.segs.at(-1)!.len).toBe(5);
    expect(st.get().canUndo).toBe(true);
  });

  it('пересечение: сообщение, состояние не меняется', () => {
    const st = new Store({ preset: 'pframe' });
    const before = st.get().s;
    expect(st.setSegDir(before.segs.at(-1)!.id, 'l')).toBe(false);
    expect(st.get().s).toBe(before);
    expect(st.get().msg.text).toBe('В этом направлении участок наложится на другой.');
    expect(st.get().canUndo).toBe(false);
  });

  it('перетаскивание — одна запись истории на весь жест', () => {
    const st = new Store();
    const M = st.get().s.items.find((i) => i.type === 'moment')!;
    const g = geom(st.get().s);
    const s0 = st.get().s;
    st.moveItem(M.id, g.order[1], true);
    st.moveItem(M.id, g.order[2], false);
    st.moveItem(M.id, g.order[4], false);
    st.undo();
    expect(st.get().s).toEqual(s0);
  });

  it('удаление элемента снимает выделение', () => {
    const st = new Store();
    const id = st.get().s.items[0].id;
    st.select(id);
    st.deleteItem(id);
    expect(st.get().sel).toBeNull();
  });

  it('каток: при выборе «наклонная» угол берётся от прежней поверхности', () => {
    const st = new Store({ preset: 'post' });
    const R = st.get().s.items.find((i) => i.type === 'roller')!;
    st.setItemField(R.id, 'side', 'tilt');
    expect(st.get().s.items.find((i) => i.id === R.id)).toMatchObject({ side: 'tilt', angle: 0 });
  });
});

describe('готовые задачи и мастер', () => {
  it('пустой шаблон включает мастер, другая задача — выключает', () => {
    const st = new Store();
    st.loadPreset('blank');
    expect(st.get().wiz).toEqual({ on: true, step: 1 });
    st.setStep(9);
    expect(st.get().wiz.step).toBe(5);
    st.loadPreset('lever');
    expect(st.get().wiz.on).toBe(false);
    expect(st.get().preset).toBe('lever');
    // Выбор задачи тоже отменяется.
    st.undo();
    expect(st.get().preset).toBe('blank');
  });

  it('«что найти» пишется в историю', () => {
    const st = new Store();
    st.setTarget('R_E', false);
    expect(st.get().nt).toEqual(['R_E']);
    st.undo();
    expect(st.get().nt).toEqual([]);
  });
});
