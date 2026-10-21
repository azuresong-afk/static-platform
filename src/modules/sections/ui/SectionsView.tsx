/**
 * Экран «Подбор сечения»: исходные данные (M и Q с эпюр или вручную, материал), эскизы трёх сечений в одном масштабе,
 * решение по шагам. Схема балки — из «Балок и рам».
 */
import { useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { Chrome } from '../../../app/module';
import { forceNames, type ConventionsStore } from '../../../shared/conventions';
import { sub, sym } from '../../../shared/doc';
import { fmtIn } from '../../../shared/format';
import { Num } from '../../../shared/ui/Num';
import { DocView, InlineView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { analyze } from '../../frames/analyze';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { analyzeBeam, beamMaxima } from '../../bending/model/beam';
import { BENDING_PRESETS } from '../../bending/presets';
import { design } from '../model/design';
import { renderSketch } from '../draw/sketch';
import { sectionsDoc } from '../text/solution';
import { sigmaOf, type SectionParams, type SectionsStore } from './store';
import { loadSectionPreset, SECTION_PRESETS, type SectionPresetKey } from '../presets';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';


export function SectionsView({ chrome, store, conv }: { chrome: Chrome; store: SectionsStore; conv: ConventionsStore }) {
  const frames = store.frames;
  const fst = useSyncExternalStore(frames.subscribe, frames.get);
  const { p, canUndo, canRedo } = useSyncExternalStore(store.subscribe, store.get);
  const c = useSyncExternalStore(conv.subscribe, conv.get);
  const names = forceNames(c);

  const a = useMemo(() => analyze(fst.s), [fst.s]);
  const beam = useMemo(() => analyzeBeam(fst.s, a), [fst.s, a]);
  const fromBeam = useMemo(() => {
    if (!beam.ok) return null;
    const mx = beamMaxima(beam.beam);
    const where = (x: number) => {
      const pt = beam.beam.points.find((q) => Math.abs(q.x - x) < 1e-9);
      return pt ? `в точке ${pt.name}` : `на расстоянии ${fmtIn(Math.round(x * 1000) / 1000)} м от ${beam.beam.points[0].name}`;
    };
    return { M: mx.M.v, Q: mx.Q.v, where: { M: where(mx.M.x), Q: where(mx.Q.x) } };
  }, [beam]);

  const useBeam = p.source === 'beam';
  const M = useBeam ? fromBeam?.M : p.M,
    Q = useBeam ? fromBeam?.Q : p.Q;
  const sigma = sigmaOf(p);
  const ready = M !== undefined && Q !== undefined && Math.abs(M) > 1e-9 && sigma > 0 && p.tau > 0 && p.k > 0;
  const d = useMemo(() => (ready ? design({ M: M!, Q: Q!, sigma, tau: p.tau, k: p.k, overload: p.overload }) : null), [ready, M, Q, sigma, p.tau, p.k, p.overload]);
  const sketch = useMemo(() => (d ? renderSketch(d) : null), [d]);
  const doc = useMemo(
    () =>
      d
        ? sectionsDoc(
            { d, M: M!, Q: Q!, where: useBeam ? fromBeam!.where : null, sigma, sigmaT: p.sigmaMode === 'yield' ? { sT: p.sigmaT, n: p.n } : undefined, tau: p.tau, k: p.k, overload: p.overload, explain: fst.explain },
            c,
          )
        : null,
    [d, M, Q, useBeam, fromBeam, sigma, p, fst.explain, c],
  );

  const presetKey = (Object.keys(SECTION_PRESETS) as SectionPresetKey[]).find((k) => {
    const sp = SECTION_PRESETS[k];
    return JSON.stringify(sp.p) === JSON.stringify(p) && (!sp.beam || BENDING_PRESETS[sp.beam].title === fst.title);
  });
  const loadPreset = (k: SectionPresetKey) => loadSectionPreset(store, k);
  const num = (key: 'M' | 'Q' | 'sigmaAllow' | 'sigmaT' | 'n' | 'tau' | 'k' | 'overload', label: ReactNode, unit?: string, zero = false) => (
    <Num key={key} id={'s-' + key} label={label} unit={unit} value={p[key]} zero={zero} onType={(v) => store.typeField(key, v)} onEnd={() => store.endSession(key)} />
  );
  const radio = <K extends 'source' | 'sigmaMode'>(key: K, value: SectionParams[K], label: string) => (
    <label className="opt">
      <input type="radio" name={'s-' + key} checked={p[key] === value} onChange={() => store.setField(key, value)} />
      <span>{label}</span>
    </label>
  );

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Подбор сечения балки</h1>
            <p className="lede">Размеры прямоугольного и круглого сечений и номер двутавра из условия прочности, сравнение по расходу материала, проверка по касательным напряжениям.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовые данные
              <select id="spreset" value={presetKey ?? 'custom'} onChange={(e) => loadPreset(e.target.value as SectionPresetKey)}>
                <PresetOptions items={taskEntries(SECTION_PRESETS)} />
                <option value="custom" hidden>
                  Свои данные
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={fst.notice} onClose={frames.closeNotice} />

        <section className="sheet" aria-label="Сечения">
          <div className="bar">
            <span className="hint">{useBeam ? `M и Q — с эпюр балки «${fst.title}» (вкладка «Изгиб»).` : 'M и Q заданы вручную.'}</span>
            <div className="hist">
              <button type="button" onClick={() => chrome.goto('bending')}>
                Эпюры
              </button>
              <button type="button" title="Отменить (Ctrl+Z)" disabled={!canUndo} onClick={store.undo}>
                <UndoIcon />
                Отменить
              </button>
              <button type="button" title="Повторить (Ctrl+Shift+Z)" disabled={!canRedo} onClick={store.redo}>
                <RedoIcon />
                Повторить
              </button>
            </div>
          </div>
          {sketch ? (
            <div className="canvas">
              <svg id="ssketch" className="sketch" viewBox={sketch.viewBox} role="img" aria-label="Подобранные сечения" dangerouslySetInnerHTML={{ __html: sketch.svg }} />
            </div>
          ) : (
            <div className="dg-empty" role="status">
              <p>
                {useBeam && !fromBeam
                  ? 'Для подбора нужны эпюры прямой определимой балки. Задайте M и Q вручную или соберите балку.'
                  : 'Задайте положительные M, [σ], [τ] и h/b.'}
              </p>
              {useBeam && !fromBeam && (
                <button type="button" onClick={() => store.setField('source', 'manual')}>
                  Задать вручную
                </button>
              )}
            </div>
          )}
        </section>

        <div className="cols">
          <section className="panel conv" aria-label="Исходные данные">
            <h2>Исходные данные</h2>
            <div className="sub">Изгибающий момент и поперечная сила</div>
            {radio('source', 'beam', 'с эпюр балки (вкладка «Изгиб»)')}
            {radio('source', 'manual', 'задать вручную')}
            {useBeam ? (
              fromBeam && (
                <p className="empty">
                  <InlineView c={['|', sym(names.M), '|', sub('max'), ` = ${fmtIn(Math.round(Math.abs(fromBeam.M) * 1000) / 1000)} кН·м, `, '|', sym(names.Q), '|', sub('max'), ` = ${fmtIn(Math.round(Math.abs(fromBeam.Q) * 1000) / 1000)} кН`]} />
                </p>
              )
            ) : (
              <div className="sgrid">
                {num('M', <InlineView c={['|', sym(names.M), '|', sub('max')]} />, 'кН·м')}
                {num('Q', <InlineView c={['|', sym(names.Q), '|', sub('max')]} />, 'кН', true)}
              </div>
            )}
            <div className="sub">Допускаемое нормальное напряжение</div>
            {radio('sigmaMode', 'allow', 'задать [σ]')}
            {radio('sigmaMode', 'yield', 'через предел текучести: [σ] = σт/n')}
            <div className="sgrid">
              {p.sigmaMode === 'allow' ? num('sigmaAllow', '[σ]', 'МПа') : [num('sigmaT', 'σт', 'МПа'), num('n', 'запас n')]}
              {num('tau', '[τ]', 'МПа')}
            </div>
            <div className="sub">Сечения</div>
            <div className="sgrid">
              {num('k', 'h/b прямоугольника')}
              {num('overload', 'перенапряжение двутавра', '%', true)}
            </div>
            <p className="empty">Нагрузки — в кН и кН·м, длины — в м. Двутавры — ГОСТ 8239-89. Размеры округляются вверх до 1 мм.</p>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={fst.explain} onChange={(e) => frames.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="ssolution">{doc ? <DocView doc={doc} /> : <p className="empty">Решение появится, когда будут заданы исходные данные.</p>}</div>
          </section>
        </div>
      </div>
      {doc && sketch && (
        <article className="print-report" aria-hidden="true">
          <header className="pr-head">
            <h1>{fst.title}: подбор сечения</h1>
            <p>Подбор сечения балки · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </header>
          <section className="pr-sec pr-figs">
            <figure>
              <svg viewBox={sketch.viewBox} dangerouslySetInnerHTML={{ __html: sketch.svg }} />
              <figcaption>Подобранные сечения в одном масштабе</figcaption>
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
