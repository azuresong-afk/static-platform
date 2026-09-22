/** Генератор идентификаторов узлов (n1…), участков (s1…) и элементов (e1…), как счётчики прототипа. */
export interface IdGen {
  node(): string;
  seg(): string;
  item(): string;
}

export function createIdGen(start: { n?: number; s?: number; e?: number } = {}): IdGen {
  let n = start.n ?? 1,
    s = start.s ?? 1,
    e = start.e ?? 1;
  return {
    node: () => 'n' + n++,
    seg: () => 's' + s++,
    item: () => 'e' + e++,
  };
}

/** Генератор, который продолжает счёт после уже занятых идентификаторов конструкции. */
export function idGenAfter(s: { nodes: { id: string }[]; segs: { id: string }[]; items: { id: string }[] }): IdGen {
  const next = (ids: string[]) => ids.reduce((m, id) => Math.max(m, parseInt(id.slice(1), 10) || 0), 0) + 1;
  return createIdGen({
    n: next(s.nodes.map((x) => x.id)),
    s: next(s.segs.map((x) => x.id)),
    e: next(s.items.map((x) => x.id)),
  });
}
