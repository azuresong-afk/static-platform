/**
 * Экран «Рамы: эпюры N, Q, M»: расчётная схема из «Балок и рам», три эпюры на осях рамы, решение по участкам,
 * правила и обозначения (общие с «Изгибом»). Схема правится в «Балках и рамах», отмена работает и здесь.
 */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { forceNames, type ConventionsStore } from '../../../shared/conventions';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { analyze } from '../../frames/analyze';
import { renderDrawing } from '../../frames/draw/drawing';
import type { Store as FramesStore } from '../../frames/ui/store';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { ConventionsPanel } from '../../bending/ui/BendingView';
import { analyzeFrame, type FrameResult } from '../model/frame';
import { renderFrameDiagrams, type DiagKey } from '../draw/frame';
import { FRAME_PRESETS, type FramePresetKey } from '../presets';
import { frameDoc } from '../text/solution';

const WHY: Record<Exclude<FrameResult, { ok: true }>['why'], string> = {
  empty: 'В схеме нет ни одного участка — соберите раму во вкладке «Балки и рамы».',
  status: 'Сначала нужна статически определимая схема: реакции должны находиться из уравнений равновесия.',
  baddist: 'Распределённая нагрузка задана между точками не на одной прямой — исправьте её в «Балках и рамах».',
};

/** Для печати — без миллиметровой сетки. */
const noGrid = (svg: string) => svg.replace(/<defs>.*?<\/defs>/, '').replace(/<rect width="\d+" height="\d+" fill="url\(#cm\)"\/>/, '');

export function FrameDiagView({ chrome, frames, conv }: { chrome: Chrome; frames: FramesStore; conv: ConventionsStore }) {
  const st = useSyncExternalStore(frames.subscribe, frames.get);
  const c = useSyncExternalStore(conv.subscribe, conv.get);
  const nt = useMemo(() => new Set(st.nt), [st.nt]);
  const a = useMemo(() => analyze(st.s, { notTarget: nt }), [st.s, nt]);
  const r = useMemo(() => analyzeFrame(st.s, a), [st.s, a]);
  const schema = useMemo(() => renderDrawing(st.s, a.model, a.solution, { view: 'schema', sel: null }), [st.s, a]);
  const dgs = useMemo(() => {
    if (!r.ok) return null;
    const names = forceNames(c);
    const d = renderFrameDiagrams(r.frame, c, { N: { ...names.N, unit: ', кН' }, Q: { ...names.Q, unit: ', кН' }, M: { ...names.M, unit: ', кН·м' } });
    return { wide: d.wide, list: (['N', 'Q', 'M'] as DiagKey[]).map((k) => ({ k, ...d.dg[k] })) };
  }, [r, c]);
  const doc = useMemo(() => (r.ok ? frameDoc(r.frame, c, { explain: st.explain }) : null), [r, c, st.explain]);
  const presetKey = (Object.keys(FRAME_PRESETS) as FramePresetKey[]).find((k) => FRAME_PRESETS[k].title === st.title) ?? 'custom';

  const load = (k: FramePresetKey) => {
    const p = FRAME_PRESETS[k];
    frames.loadStructure(p.build(frames.ids), p.title);
  };
  const figs = (print: boolean) =>
    dgs && (
      <div className={dgs.wide ? 'fd-grid wide' : 'fd-grid'}>
        {dgs.list.map((d) => (
          <svg key={d.k} id={print ? undefined : 'fd-' + d.k} className="fd-dg" viewBox={d.viewBox} role="img" aria-label={`Эпюра ${d.k}`} dangerouslySetInnerHTML={{ __html: d.svg }} />
        ))}
      </div>
    );

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Рамы: эпюры N, Q, M</h1>
            <p className="lede">Продольные и поперечные силы и изгибающие моменты в плоской раме, в том числе с наклонными стержнями и шарнирами, — методом сечений по участкам, с проверкой равновесия узлов. Схема берётся из вкладки «Балки и рамы».</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="fdpreset" value={presetKey} onChange={(e) => load(e.target.value as FramePresetKey)}>
                {(Object.keys(FRAME_PRESETS) as FramePresetKey[]).map((k) => (
                  <option key={k} value={k}>
                    {FRAME_PRESETS[k].title}
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
            <span className="hint">«{st.title}». Изменить схему, опоры и нагрузки можно во вкладке «Балки и рамы».</span>
            <div className="hist">
              <button type="button" id="fdedit" onClick={() => chrome.goto('frames')}>
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
          {r.ok ? (
            <div className="canvas fd-canvas">
              <svg id="fdschema" viewBox={schema.viewBox} role="img" aria-label="Расчётная схема" dangerouslySetInnerHTML={{ __html: schema.svg }} />
              {figs(false)}
            </div>
          ) : (
            <div className="dg-empty" role="status">
              <p>{WHY[r.why]}</p>
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
            <div id="fdsolution">{doc ? <DocView doc={doc} /> : <p className="empty">Решение появится, когда схема станет статически определимой.</p>}</div>
          </section>
        </div>
      </div>
      {r.ok && doc && (
        <article className="print-report" aria-hidden="true">
          <header className="pr-head">
            <h1>{st.title}</h1>
            <p>Рамы: эпюры N, Q, M · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </header>
          <section className="pr-sec pr-figs pr-dg">
            <figure>
              <svg viewBox={schema.viewBox} role="img" aria-label="Расчётная схема" dangerouslySetInnerHTML={{ __html: noGrid(schema.svg) }} />
              {figs(true)}
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
