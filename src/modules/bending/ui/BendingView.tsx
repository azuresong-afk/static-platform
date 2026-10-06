/**
 * Экран вкладки «Изгиб»: расчётная схема из «Балок и рам», эпюры Q и M под ней, решение по участкам,
 * правила и обозначения. Схема общая с «Балками и рамами» — правится там, отмена работает и здесь.
 */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { forceNames, type Conventions, type ConventionsStore } from '../../../shared/conventions';
import type { Doc } from '../../../shared/doc';
import { DocView, InlineView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { sym } from '../../../shared/doc';
import { analyze } from '../../frames/analyze';
import { renderDrawing, type Drawing } from '../../frames/draw/drawing';
import type { Store as FramesStore } from '../../frames/ui/store';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { analyzeBeam, type BeamResult } from '../model/beam';
import { renderDiagrams, type DiagramsSVG } from '../draw/diagrams';
import { BENDING_PRESETS, type BendingPresetKey } from '../presets';
import { bendingDoc } from '../text/solution';

const WHY: Record<Exclude<BeamResult, { ok: true }>['why'], string> = {
  notbeam: 'Здесь эпюры строятся для прямых горизонтальных балок. Для рам с вертикальными и наклонными участками — вкладка «Рамы: эпюры N, Q, M».',
  status: 'Сначала нужна статически определимая схема: реакции должны находиться из уравнений равновесия.',
  baddist: 'Распределённая нагрузка задана между точками не на одной прямой — исправьте её в «Балках и рамах».',
};

/** Для печати — без миллиметровой сетки. */
const noGrid = (svg: string) => svg.replace(/<defs>.*?<\/defs>/, '').replace(/<rect width="\d+" height="\d+" fill="url\(#cm\)"\/>/, '');

function Figures({ schema, dg, idPrefix }: { schema: Drawing; dg: DiagramsSVG; idPrefix?: string }) {
  return (
    <>
      <svg id={idPrefix ? idPrefix + 'schema' : undefined} viewBox={schema.viewBox} role="img" aria-label="Расчётная схема" dangerouslySetInnerHTML={{ __html: idPrefix ? schema.svg : noGrid(schema.svg) }} />
      <svg id={idPrefix ? idPrefix + 'dg' : undefined} className="dg" viewBox={dg.viewBox} role="img" aria-label="Эпюры" dangerouslySetInnerHTML={{ __html: dg.svg }} />
    </>
  );
}

export function ConventionsPanel({ c, conv }: { c: Conventions; conv: ConventionsStore }) {
  const n = forceNames(c);
  const radio = <K extends keyof Conventions>(key: K, value: Conventions[K], label: string, hint?: string) => (
    <label className="opt">
      <input type="radio" name={key} checked={c[key] === value} onChange={() => conv.set({ [key]: value } as Partial<Conventions>)} />
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
  return (
    <section className="panel conv" aria-label="Правила и обозначения">
      <h2>Правила и обозначения</h2>
      <p className="empty">Выберите, как принято в вашем учебнике. Настройка запоминается в браузере.</p>
      <div className="sub">Эпюра изгибающего момента</div>
      {radio('mSide', 'compressed', 'на сжатых волокнах', '«+» вверх — машиностроение, Антонов')}
      {radio('mSide', 'tension', 'на растянутых волокнах', '«+» вниз — строительная механика')}
      <div className="sub">Ось вдоль балки</div>
      {radio('axis', 'z', 'z')}
      {radio('axis', 'x', 'x')}
      <div className="sub">Обозначения усилий</div>
      {radio('indexed', false, 'Q, M')}
      {radio('indexed', true, c.axis === 'z' ? 'Qy, Mx' : 'Qy, Mz', 'с индексами осей')}
      <p className="empty">
        Сейчас: <InlineView c={[sym(n.Q), ', ', sym(n.M), '; ось ', { t: 'v', text: c.axis }]} />.
      </p>
    </section>
  );
}

export function BendingView({ chrome, frames, conv }: { chrome: Chrome; frames: FramesStore; conv: ConventionsStore }) {
  const st = useSyncExternalStore(frames.subscribe, frames.get);
  const c = useSyncExternalStore(conv.subscribe, conv.get);
  const nt = useMemo(() => new Set(st.nt), [st.nt]);
  const a = useMemo(() => analyze(st.s, { notTarget: nt }), [st.s, nt]);
  const r = useMemo(() => analyzeBeam(st.s, a), [st.s, a]);
  const schema = useMemo(() => renderDrawing(st.s, a.model, a.solution, { view: 'schema', sel: null }), [st.s, a]);
  const dg = useMemo(() => (r.ok ? renderDiagrams(r.beam, schema.layout, c) : null), [r, schema, c]);
  const doc: Doc | null = useMemo(() => (r.ok ? bendingDoc(r.beam, c, { explain: st.explain }) : null), [r, c, st.explain]);
  const presetKey = (Object.keys(BENDING_PRESETS) as BendingPresetKey[]).find((k) => BENDING_PRESETS[k].title === st.title) ?? 'custom';

  const load = (k: BendingPresetKey) => {
    const p = BENDING_PRESETS[k];
    frames.loadStructure(p.build(frames.ids), p.title);
  };

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Изгиб: эпюры Q и M</h1>
            <p className="lede">Эпюры поперечных сил и изгибающих моментов методом сечений — по участкам, с формулами и проверками. Схема берётся из вкладки «Балки и рамы».</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="bpreset" value={presetKey} onChange={(e) => load(e.target.value as BendingPresetKey)}>
                {(Object.keys(BENDING_PRESETS) as BendingPresetKey[]).map((k) => (
                  <option key={k} value={k}>
                    {BENDING_PRESETS[k].title}
                  </option>
                ))}
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={frames.closeNotice} />

        <section className="sheet" aria-label="Эпюры">
          <div className="bar">
            <span className="hint">
              «{st.title}». Изменить схему, опоры и нагрузки можно во вкладке «Балки и рамы».
            </span>
            <div className="hist">
              <button type="button" id="bedit" onClick={() => chrome.goto('frames')}>
                Изменить схему
              </button>
              <button type="button" title="Отменить (Ctrl+Z)" disabled={!st.canUndo} onClick={frames.undo}>
                <UndoIcon />
                Отменить
              </button>
              <button type="button" title="Повторить (Ctrl+Shift+Z)" disabled={!st.canRedo} onClick={frames.redo}>
                <RedoIcon />
                Повторить
              </button>
            </div>
          </div>
          {r.ok && dg ? (
            <div className="canvas dg-canvas">
              <Figures schema={schema} dg={dg} idPrefix="b" />
            </div>
          ) : (
            <div className="dg-empty" role="status">
              <p>{WHY[r.ok ? 'status' : r.why]}</p>
              <button type="button" onClick={() => chrome.goto('frames')}>
                Открыть «Балки и рамы»
              </button>
            </div>
          )}
        </section>

        <div className="cols">
          <ConventionsPanel c={c} conv={conv} />
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => frames.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="bsolution">{doc ? <DocView doc={doc} /> : <p className="empty">Решение появится, когда схема станет прямой определимой балкой.</p>}</div>
          </section>
        </div>
      </div>
      {r.ok && dg && doc && (
        <article className="print-report" aria-hidden="true">
          <header className="pr-head">
            <h1>{st.title}</h1>
            <p>Изгиб: эпюры Q и M · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </header>
          <section className="pr-sec pr-figs pr-dg">
            <figure>
              <Figures schema={schema} dg={dg} />
              <figcaption>Расчётная схема и эпюры</figcaption>
            </figure>
          </section>
          <section className="pr-sec">
            <h2>Решение</h2>
            <DocView doc={doc} />
          </section>
        </article>
      )}
    </>
  );
}
