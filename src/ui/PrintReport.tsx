/**
 * Отчёт для печати и сохранения в PDF: на экране скрыт, при печати заменяет страницу.
 * Состав: заголовок, «Дано», чертёж в двух видах, «Найти», пошаговое решение.
 */
import { useMemo } from 'react';
import type { Analysis } from '../core';
import { renderDrawing } from '../draw/drawing';
import type { Structure } from '../model/types';
import { givenData, targetsInline } from '../text/given';
import { STATUS } from '../text/labels';
import { DocView, InlineView } from './DocView';

/** Для печати — без миллиметровой сетки (и без ссылок на узоры, объявленные в скрытом чертеже страницы). */
const noGrid = (svg: string) => svg.replace(/<defs>.*?<\/defs>/, '').replace(/<rect width="\d+" height="\d+" fill="url\(#cm\)"\/>/, '');

export function PrintReport({ s, a, notTarget, title }: { s: Structure; a: Analysis; notTarget: ReadonlySet<string>; title: string }) {
  const given = useMemo(() => givenData(s.items, a.model), [s, a]);
  const construct = useMemo(() => renderDrawing(s, a.model, a.solution, { view: 'construct', sel: null }), [s, a]);
  const schema = useMemo(() => renderDrawing(s, a.model, a.solution, { view: 'schema', sel: null }), [s, a]);
  const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <article className="print-report" aria-hidden="true">
      <header className="pr-head">
        <h1>{title}</h1>
        <p>
          Статика: балки и рамы · {date} · система {STATUS[a.solution.status][0]}
        </p>
      </header>
      <section className="pr-sec">
        <h2>Дано</h2>
        <p>
          Точки ({given.size}):{' '}
          {given.points.map((p, i) => (
            <span key={i}>
              {i ? '; ' : ''}
              <InlineView c={p} />
            </span>
          ))}
          .
        </p>
        <ul>
          {given.items.map((r, i) => (
            <li key={i}>
              <InlineView c={r} />
            </li>
          ))}
        </ul>
        {a.model.unknowns.length > 0 && (
          <p>
            <b>Найти:</b> <InlineView c={targetsInline(a.model, notTarget)} />.
          </p>
        )}
      </section>
      <section className="pr-sec pr-figs">
        <figure>
          <svg viewBox={construct.viewBox} dangerouslySetInnerHTML={{ __html: noGrid(construct.svg) }} />
          <figcaption>Конструкция</figcaption>
        </figure>
        <figure>
          <svg viewBox={schema.viewBox} dangerouslySetInnerHTML={{ __html: noGrid(schema.svg) }} />
          <figcaption>Расчётная схема</figcaption>
        </figure>
      </section>
      <section className="pr-sec">
        <h2>Решение</h2>
        <DocView doc={a.doc} />
      </section>
    </article>
  );
}
