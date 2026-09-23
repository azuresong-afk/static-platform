/** Файл проекта: сохранить → загрузить без потерь; понятные ошибки на испорченных файлах. */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core';
import { resolve } from '../src/model/geometry';
import { createIdGen } from '../src/model/ids';
import { loadPreset, PRESETS, type PresetKey } from '../src/model/presets';
import { parseProject, projectFileName, remapIds, serializeProject } from '../src/model/project';
import type { Structure } from '../src/model/types';
import { goldenRandom } from './helpers/golden';

const roundtrip = (s: Structure, nt: string[] = []) => {
  const text = serializeProject({ title: 'Тест', structure: s, notTarget: nt }, new Date('2026-09-23T10:00:00Z'));
  const r = parseProject(text);
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r.project;
};

describe('сохранить и загрузить', () => {
  for (const k of Object.keys(PRESETS) as PresetKey[])
    it(`готовая задача ${k}: конструкция и решение те же`, () => {
      const s = resolve(loadPreset(k)).structure;
      const p = roundtrip(s, ['X_A']);
      expect(resolve(p.structure).structure).toEqual(s);
      expect(analyze(p.structure).html).toBe(analyze(s).html);
      expect(p.notTarget).toEqual(['X_A']);
      expect(p.title).toBe('Тест');
    });

  it('случайные конструкции: решение то же (200 случаев)', () => {
    for (const g of goldenRandom.slice(0, 200)) {
      const s = resolve({ nodes: g.input!.nodes, segs: g.input!.segs, items: g.input!.items }).structure;
      const p = roundtrip(s, g.input!.notTarget);
      const nt = new Set(g.input!.notTarget);
      expect(analyze(p.structure, { notTarget: nt }).html).toBe(analyze(s, { notTarget: nt }).html);
    }
  });

  it('производные поля (координаты) не сохраняются', () => {
    const s = loadPreset('simple');
    const withXY = { ...s, items: s.items.map((it) => ({ ...it, x: 1, y: 2 })) } as Structure;
    const text = serializeProject({ title: 't', structure: withXY, notTarget: [] });
    expect(text).not.toMatch(/"x":/);
    expect(JSON.parse(text)).toMatchObject({ format: 'statika-project', version: 1 });
  });

  it('новые идентификаторы при загрузке сохраняют связи', () => {
    const s = loadPreset('pframe');
    const r = remapIds(s, createIdGen({ n: 100, s: 100, e: 100 }));
    expect(r.nodes[0].id).toBe('n100');
    expect(analyze(r).html).toBe(analyze(s).html);
  });

  it('имя файла', () => {
    expect(projectFileName('Балка: вариант 1/2', new Date('2026-09-23T10:00:00Z'))).toBe('Балка вариант 1 2 2026-09-23.statika.json');
  });
});

describe('ошибки в файле', () => {
  const good = () => JSON.parse(serializeProject({ title: 't', structure: loadPreset('simple'), notTarget: [] }));
  const errs = (o: unknown) => {
    const r = parseProject(typeof o === 'string' ? o : JSON.stringify(o));
    expect(r.ok).toBe(false);
    return r.ok ? [] : r.errors;
  };
  it('не JSON', () => expect(errs('{нет')[0]).toMatch(/не является JSON/));
  it('чужой файл', () => expect(errs({ a: 1 })[0]).toMatch(/не файл проекта/));
  it('версия новее', () => expect(errs({ ...good(), version: 99 })[0]).toMatch(/новее/));
  it('ссылка на несуществующую точку', () => {
    const o = good();
    o.structure.items[0].at = 'zzz';
    expect(errs(o)[0]).toBe('Элемент №1 (шарнирно-неподвижная опора): привязан к несуществующей точке.');
  });
  it('неверное число и направление', () => {
    const o = good();
    o.structure.items[2].F = 'десять';
    o.structure.segs[0].dir = 'x';
    const e = errs(o);
    expect(e).toContain('Участок №1: неизвестное направление «x».');
    expect(e).toContain('Элемент №3 (сила): модуль должен быть числом.');
  });
  it('пересечение участков', () => {
    const o = good();
    o.structure.segs[1].dir = 'l';
    expect(errs(o)[0]).toMatch(/пересекаются/);
  });
  it('лишний участок (замкнутый контур)', () => {
    const o = good();
    o.structure.segs.push({ id: 'sx', a: o.structure.nodes[0].id, b: o.structure.nodes[4].id, dir: 'r', len: 6 });
    expect(errs(o)[0]).toMatch(/без замкнутых контуров/);
  });
});
