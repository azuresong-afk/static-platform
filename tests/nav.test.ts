/** Навигация по задачникам и реестр готовых задач: каждый раздел в одном блоке, источники задач распознаются. */
import { describe, expect, it } from 'vitest';
import { createModules } from '../src/app/registry';
import { blockOf, NAV, NAV_BLOCKS } from '../src/app/nav';
import { groupTasks, taskInfo } from '../src/shared/tasks';

describe('источник задачи по названию', () => {
  it('Мещерский: параграф и номер, в том числе диапазоны и перечисления', () => {
    expect(taskInfo('Мещерский 46.19: составная балка на трёх опорах')).toMatchObject({
      book: 'mesh',
      group: 'mesh:46',
      num: '46.19',
      label: '46.19: составная балка на трёх опорах',
      order: [46, 19],
    });
    expect(taskInfo('Мещерский 48.37–48.38: эллиптический маятник')).toMatchObject({ num: '48.37–48.38', groupTitle: '§ 48. Уравнения Лагранжа 2-го рода' });
    expect(taskInfo('Мещерский 34.25, 34.27: эксцентричный диск')).toMatchObject({ num: '34.25, 34.27', order: [34, 25] });
  });
  it('Антонов: задачи гл. 12 и рисунки глав', () => {
    expect(taskInfo('Антонов, задача 1.1, схема 1 (группа 20, Z = 5): найти A')).toMatchObject({
      book: 'ant',
      group: 'ant:t1',
      groupTitle: 'Задача 1. Растяжение-сжатие',
      label: 'Задача 1.1, схема 1 (группа 20, Z = 5): найти A',
    });
    expect(taskInfo('Антонов, задача 2, схема 7 (группа 10, Z = 5)')).toMatchObject({ group: 'ant:t2' });
    expect(taskInfo('Антонов, рис. 8.5: пролёт 3l, нагрузка q на 2l')).toMatchObject({ group: 'ant:ch8', groupTitle: 'Гл. 8. Изгиб', num: 'рис. 8.5' });
    expect(taskInfo('Балка на двух опорах')).toMatchObject({ book: 'other', group: 'other' });
  });
  it('группы: Мещерский по параграфам, затем Антонов, затем примеры; внутри — по номерам', () => {
    const g = groupTasks([
      { key: 'a', title: 'Пример' },
      { key: 'b', title: 'Мещерский 4.25: балка' },
      { key: 'c', title: 'Мещерский 3.12: балка' },
      { key: 'd', title: 'Мещерский 3.7: балка' },
      { key: 'e', title: 'Антонов, задача 4: рис. 1' },
    ]);
    expect(g.map((x) => x.group)).toEqual(['mesh:3', 'mesh:4', 'ant:t4', 'other']);
    expect(g[0].items.map((x) => x.key)).toEqual(['d', 'c']);
  });
});

describe('навигация и реестр задач', () => {
  const modules = createModules();
  it('каждый раздел — ровно в одном блоке, блоков пять', () => {
    const tabs = NAV_BLOCKS.flatMap((b) => b.tabs);
    expect(new Set(tabs).size).toBe(tabs.length);
    expect(new Set(tabs)).toEqual(new Set(modules.map((m) => m.id)));
    expect(NAV.map((c) => c.book)).toEqual(['Мещерский', 'Антонов']);
    expect(blockOf('lagrange')?.id).toBe('analytic');
  });
  it('у каждого раздела есть готовые задачи; источник указан в начале названия', () => {
    for (const m of modules) {
      expect(m.tasks?.length, m.id).toBeGreaterThan(0);
      expect(m.loadTask, m.id).toBeTypeOf('function');
      for (const t of m.tasks!) {
        const info = taskInfo(t.title);
        // Название, где книга упомянута, но не разобрана, — ошибка в названии.
        if (/Мещерск|Антонов/.test(t.title)) expect(info.book, t.title).not.toBe('other');
      }
    }
  });
  it('каждая задача загружается без ошибок', () => {
    for (const m of modules) for (const t of m.tasks!) expect(() => m.loadTask!(t.key), `${m.id}: ${t.title}`).not.toThrow();
  });
  it('задачи Мещерского для «Балок и рам» — все 36 из задачника, с ответом', () => {
    const fr = modules.find((m) => m.id === 'frames')!;
    const book = fr.tasks!.filter((t) => t.key.startsWith('tb:'));
    expect(book).toHaveLength(36);
    expect(new Set(book.map((t) => t.key)).size).toBe(36);
    fr.loadTask!('tb:3.7');
    expect(fr.store.projectTitle()).toBe('Мещерский 3.7: балка на двух опорах, конец оттянут тросом через блок');
  });
});
