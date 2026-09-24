/**
 * Структура текста решения: шаги → блоки → строчные элементы.
 * Один источник для HTML (совместим с прототипом), а позже — для PDF и символьного режима.
 */

export type Inline =
  | string
  /** Переменная курсивом: <span class="v">. */
  | { t: 'v'; text: string }
  | { t: 'sub'; text: string }
  /** Верхний индекс (номер части составной конструкции). */
  | { t: 'sup'; text: string }
  /** Обозначение с индексом: буква курсивом и нижний индекс. */
  | { t: 'sym'; L: string; S: string }
  | { t: 'b'; c: Inline[] };

export type Block =
  | { k: 'p'; cls?: string; c: Inline[] }
  | { k: 'ul'; items: Inline[][] }
  /** Формулы: каждая строка — либо запись уравнения, либо численная подстановка (num). */
  | { k: 'eq'; lines: { num?: boolean; c: Inline[] }[] }
  | { k: 'badge'; tone: 'ok' | 'warn' | 'bad'; text: string }
  | { k: 'answer'; rows: AnswerRow[] };

export interface AnswerRow {
  kind: 'main' | 'aux' | 'total';
  val: Inline[];
  note: string;
}

export interface Step {
  title: string;
  blocks: Block[];
}

export interface Doc {
  steps: Step[];
}

/* ---------- построители ---------- */

export const v = (text: string): Inline => ({ t: 'v', text });
export const sub = (text: string): Inline => ({ t: 'sub', text });
export const sup = (text: string): Inline => ({ t: 'sup', text });
export const sym = (o: { L: string; S: string }): Inline => ({ t: 'sym', L: o.L, S: o.S });
export const b = (...c: Inline[]): Inline => ({ t: 'b', c });

/** Соединить списки строчных элементов разделителем. */
export function join(parts: Inline[][], sep: string): Inline[] {
  const r: Inline[] = [];
  parts.forEach((p, i) => {
    if (i) r.push(sep);
    r.push(...p);
  });
  return r;
}

/* ---------- HTML ---------- */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;');

export function inlineHTML(c: Inline[]): string {
  return c
    .map((x) => {
      if (typeof x === 'string') return esc(x);
      switch (x.t) {
        case 'v':
          return `<span class="v">${esc(x.text)}</span>`;
        case 'sub':
          return `<sub>${esc(x.text)}</sub>`;
        case 'sup':
          return `<sup>${esc(x.text)}</sup>`;
        case 'sym':
          return `<span class="v">${esc(x.L)}</span>${x.S ? `<sub>${esc(x.S)}</sub>` : ''}`;
        case 'b':
          return `<b>${inlineHTML(x.c)}</b>`;
      }
    })
    .join('');
}

const BADGE = { ok: 'b-ok', warn: 'b-warn', bad: 'b-bad' } as const;

export function blockHTML(bl: Block): string {
  switch (bl.k) {
    case 'p':
      return `<p${bl.cls ? ` class="${bl.cls}"` : ''}>${inlineHTML(bl.c)}</p>`;
    case 'ul':
      return `<ul>${bl.items.map((i) => `<li>${inlineHTML(i)}</li>`).join('')}</ul>`;
    case 'eq':
      return `<div class="eq">${bl.lines.map((l) => `<span class="ln${l.num ? ' num' : ''}">${inlineHTML(l.c)}</span>`).join('')}</div>`;
    case 'badge':
      return `<span class="badge ${BADGE[bl.tone]}">${esc(bl.text)}</span>`;
    case 'answer':
      return (
        '<div class="tablewrap"><table class="ans"><tbody>' +
        bl.rows
          .map(
            (r) =>
              `<tr class="${r.kind === 'aux' ? 'aux' : r.kind === 'total' ? 'total' : ''}"><td class="val">${inlineHTML(r.val)}</td><td class="note">${esc(r.note)}</td></tr>`,
          )
          .join('') +
        '</tbody></table></div>'
      );
  }
}

/** HTML решения в разметке прототипа (классы .step, .eq, .badge, .ans). */
export function docHTML(d: Doc): string {
  return d.steps
    .map((s, i) => `<div class="step"><h3><span class="n">${i + 1}</span>${esc(s.title)}</h3>${s.blocks.map(blockHTML).join('')}</div>`)
    .join('');
}

/** Простой текст (для поиска, копирования и тестов). */
export function inlineText(c: Inline[]): string {
  return c
    .map((x) => {
      if (typeof x === 'string') return x;
      switch (x.t) {
        case 'v':
        case 'sub':
          return x.text;
        case 'sup':
          return '^' + x.text;
        case 'sym':
          return x.L + (x.S ? '_' + x.S : '');
        case 'b':
          return inlineText(x.c);
      }
    })
    .join('');
}
