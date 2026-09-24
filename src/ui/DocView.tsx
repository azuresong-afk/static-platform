/** Отрисовка структурированного решения (src/text/doc.ts) в React. Разметка — как у прототипа. */
import { Fragment, type ReactNode } from 'react';
import type { Block, Doc, Inline } from '../text/doc';

export function InlineView({ c }: { c: Inline[] }): ReactNode {
  return c.map((x, i) => {
    if (typeof x === 'string') return <Fragment key={i}>{x}</Fragment>;
    switch (x.t) {
      case 'v':
        return (
          <span key={i} className="v">
            {x.text}
          </span>
        );
      case 'sub':
        return <sub key={i}>{x.text}</sub>;
      case 'sup':
        return <sup key={i}>{x.text}</sup>;
      case 'sym':
        return (
          <Fragment key={i}>
            <span className="v">{x.L}</span>
            {x.S ? <sub>{x.S}</sub> : null}
          </Fragment>
        );
      case 'b':
        return (
          <b key={i}>
            <InlineView c={x.c} />
          </b>
        );
    }
  });
}

const BADGE = { ok: 'b-ok', warn: 'b-warn', bad: 'b-bad' } as const;

function BlockView({ b }: { b: Block }): ReactNode {
  switch (b.k) {
    case 'p':
      return (
        <p className={b.cls}>
          <InlineView c={b.c} />
        </p>
      );
    case 'ul':
      return (
        <ul>
          {b.items.map((it, i) => (
            <li key={i}>
              <InlineView c={it} />
            </li>
          ))}
        </ul>
      );
    case 'eq':
      return (
        <div className="eq">
          {b.lines.map((l, i) => (
            <span key={i} className={l.num ? 'ln num' : 'ln'}>
              <InlineView c={l.c} />
            </span>
          ))}
        </div>
      );
    case 'badge':
      return <span className={`badge ${BADGE[b.tone]}`}>{b.text}</span>;
    case 'answer':
      return (
        <div className="tablewrap">
          <table className="ans">
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i} className={r.kind === 'main' ? undefined : r.kind}>
                  <td className="val">
                    <InlineView c={r.val} />
                  </td>
                  <td className="note">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function DocView({ doc }: { doc: Doc }) {
  return (
    <>
      {doc.steps.map((s, i) => (
        <div className="step" key={i}>
          <h3>
            <span className="n">{i + 1}</span>
            {s.title}
          </h3>
          {s.blocks.map((b, j) => (
            <BlockView b={b} key={j} />
          ))}
        </div>
      ))}
    </>
  );
}
