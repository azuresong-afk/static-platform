/** Экран «Графическая статика»: диаграмма Кремоны для фермы, силовой и верёвочный многоугольники для балки, цепной мост. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { taskEntries } from '../../../shared/tasks';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { nodeName, solveTruss } from '../../truss/model/truss';
import { renderChainForce, renderChainSpace, renderBeamSpace, renderForcePolygon } from '../draw/funicular';
import { renderCremona, renderSpace } from '../draw/truss';
import { cremona } from '../model/cremona';
import { chain, funicular } from '../model/funicular';
import { GRAPH_PRESETS, type GraphPresetKey } from '../presets';
import { chainDoc, cremonaDoc, funicularDoc } from '../text/solution';
import type { GraphStore } from './store';

const KIND_TITLE = { truss: 'Диаграмма Кремоны', beam: 'Верёвочный многоугольник', chain: 'Цепной мост' } as const;

export function GraphStatView({ chrome, store }: { chrome: Chrome; store: GraphStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const preset = st.preset === 'custom' ? null : GRAPH_PRESETS[st.preset];
  const t = st.truss;

  const model = useMemo(() => {
    if (st.kind === 'truss') {
      const res = solveTruss(t);
      const cr = cremona(t, res);
      const book = preset && preset.kind === 'truss' ? preset.book : undefined;
      const a = cr.ok ? renderSpace(t, res, cr) : res.status === 'ok' ? renderSpace(t, res, cr) : { svg: '', viewBox: '0 0 10 10' };
      const bfig = cr.ok ? renderCremona(res, cr) : null;
      return {
        a,
        b: bfig,
        doc: cremonaDoc(t, res, cr, { explain: st.explain, book }),
        aLabel: 'Ферма с обозначениями Боу',
        bLabel: 'Диаграмма Максвелла–Кремоны',
      };
    }
    if (st.kind === 'beam') {
      const r = funicular(st.beam);
      const book = preset && preset.kind === 'beam' ? preset.book : undefined;
      return {
        a: renderBeamSpace(st.beam, r),
        b: r.ok
          ? renderForcePolygon(
              st.beam.loads.filter((l) => Math.abs(l.F) > 1e-12),
              r,
            )
          : null,
        doc: funicularDoc(st.beam, r, { explain: st.explain, bookR: book }),
        aLabel: 'Балка и верёвочный многоугольник',
        bLabel: 'Силовой многоугольник и полюс',
      };
    }
    const c = chain(st.chain);
    const book = preset && preset.kind === 'chain' ? preset.book : undefined;
    return {
      a: renderChainSpace(c, st.chain.L, st.chain.f),
      b: c.ok ? renderChainForce(c) : null,
      doc: chainDoc(st.chain, c, { explain: st.explain, bookT: book?.T }),
      aLabel: 'Цепь — верёвочный многоугольник',
      bLabel: 'Силовой многоугольник цепи',
    };
  }, [st.kind, st.truss, st.beam, st.chain, st.explain, preset, t]);

  const nodeSel = (value: number, onChange: (v: number) => void, label: string) => (
    <select aria-label={label} value={value} onChange={(e) => onChange(+e.target.value)}>
      {t.nodes.map((_, i) => (
        <option key={i} value={i}>
          {nodeName(i)}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Графическая статика</h1>
            <p className="lede">
              Построения вместо вычислений: диаграмма Максвелла–Кремоны для плоской фермы, силовой и верёвочный многоугольники для балки, цепной мост. Каждое
              построение сверено с аналитическим решением.
            </p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="gpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as GraphPresetKey)}>
                <PresetOptions items={taskEntries(GRAPH_PRESETS)} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />

        <section className="sheet" aria-label={KIND_TITLE[st.kind]}>
          <div className="bar">
            <span className="hint">
              {KIND_TITLE[st.kind]}:{' '}
              {st.kind === 'truss'
                ? 'растяжение — синий, сжатие — красный.'
                : st.kind === 'beam'
                  ? 'силы — в тоннах, длины — в метрах.'
                  : 'нагрузка передаётся подвесками в вершины.'}
            </span>
            <div className="hist">
              <button type="button" title="Отменить (Ctrl+Z)" disabled={!st.canUndo} onClick={store.undo}>
                <UndoIcon />
                Отменить
              </button>
              <button type="button" title="Повторить (Ctrl+Shift+Z)" disabled={!st.canRedo} onClick={store.redo}>
                <RedoIcon />
                Повторить
              </button>
            </div>
          </div>
          <div className="canvas">
            <svg
              id="gsvg"
              className="sketch"
              viewBox={model.a.viewBox}
              role="img"
              aria-label={model.aLabel}
              dangerouslySetInnerHTML={{ __html: model.a.svg }}
            />
          </div>
          {model.b && (
            <div className="canvas">
              <svg
                id="gsvg2"
                className="sketch"
                viewBox={model.b.viewBox}
                role="img"
                aria-label={model.bLabel}
                dangerouslySetInnerHTML={{ __html: model.b.svg }}
              />
            </div>
          )}
        </section>

        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Данные</h2>
            {st.kind === 'truss' && (
              <>
                <div className="sub">Узлы, м</div>
                <div className="asteps" id="gnodes">
                  {t.nodes.map((p, i) => (
                    <div className="trow" key={i} style={{ gridTemplateColumns: '24px 1fr 1fr' }}>
                      <span className="segname">{nodeName(i)}</span>
                      <Num
                        id={`g-x${i}`}
                        label=""
                        unit="x"
                        value={p.x}
                        neg
                        onType={(x) => store.typeNode(i, 'x', x)}
                        onEnd={() => store.endSession(`node:${i}:x`)}
                      />
                      <Num
                        id={`g-y${i}`}
                        label=""
                        unit="y"
                        value={p.y}
                        neg
                        onType={(x) => store.typeNode(i, 'y', x)}
                        onEnd={() => store.endSession(`node:${i}:y`)}
                      />
                    </div>
                  ))}
                </div>
                <div className="sub">Силы в узлах</div>
                <div className="asteps" id="gloads">
                  {t.loads.map((l, j) => (
                    <div className="trow trow4" key={j}>
                      {nodeSel(l.node, (x) => store.setLoadNode(j, x), `Узел силы ${j + 1}`)}
                      <Num
                        id={`g-F${j}`}
                        label=""
                        unit="т"
                        value={l.F}
                        neg
                        onType={(x) => store.typeLoad(j, 'F', x)}
                        onEnd={() => store.endSession(`load:${j}:F`)}
                      />
                      <Num
                        id={`g-a${j}`}
                        label=""
                        unit="°"
                        value={l.angle}
                        neg
                        onType={(x) => store.typeLoad(j, 'angle', x)}
                        onEnd={() => store.endSession(`load:${j}:angle`)}
                      />
                      <button type="button" className="del" aria-label="Убрать силу" onClick={() => store.removeLoad(j)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="gaddload" onClick={store.addLoad}>
                    + сила
                  </button>
                </div>
                <p className="empty">
                  Стержни и опоры берутся из готовой задачи; свою ферму со стержнями и опорами строят в разделе «Фермы». Угол силы — к оси x: 270° — вниз.
                </p>
              </>
            )}
            {st.kind === 'beam' && (
              <>
                <div className="sub">Опоры</div>
                <div className="asteps">
                  <Num
                    id="g-xA"
                    label="Шарнир A: x"
                    unit="м"
                    value={st.beam.xA}
                    neg
                    onType={(x) => store.typeBeam('xA', x)}
                    onEnd={() => store.endSession('beam:xA')}
                  />
                  <Num
                    id="g-xB"
                    label="Каток B: x"
                    unit="м"
                    value={st.beam.xB}
                    neg
                    onType={(x) => store.typeBeam('xB', x)}
                    onEnd={() => store.endSession('beam:xB')}
                  />
                  <Num
                    id="g-aB"
                    label="Направление R_B"
                    unit="°"
                    value={st.beam.angleB}
                    neg
                    onType={(x) => store.typeBeam('angleB', x)}
                    onEnd={() => store.endSession('beam:angleB')}
                  />
                  <Num
                    id="g-pole"
                    label="Полюсное расстояние H"
                    unit="т"
                    value={st.beam.pole ?? 0}
                    zero
                    onType={(x) => store.typeBeam('pole', x)}
                    onEnd={() => store.endSession('beam:pole')}
                  />
                </div>
                <p className="empty">H = 0 — полюс выбирается сам. Другое H меняет форму верёвочного многоугольника, но не реакции.</p>
                <div className="sub">Нагрузки</div>
                <div className="asteps" id="gbloads">
                  {st.beam.loads.map((l, j) => (
                    <div className="trow trow4" key={j} style={{ gridTemplateColumns: '1fr 1fr 1fr 26px' }}>
                      <Num
                        id={`g-lx${j}`}
                        label=""
                        unit="x"
                        value={l.x}
                        neg
                        onType={(x) => store.typeBeamLoad(j, 'x', x)}
                        onEnd={() => store.endSession(`bl:${j}:x`)}
                      />
                      <Num
                        id={`g-lF${j}`}
                        label=""
                        unit="т"
                        value={l.F}
                        neg
                        onType={(x) => store.typeBeamLoad(j, 'F', x)}
                        onEnd={() => store.endSession(`bl:${j}:F`)}
                      />
                      <Num
                        id={`g-la${j}`}
                        label=""
                        unit="°"
                        value={l.angle}
                        neg
                        onType={(x) => store.typeBeamLoad(j, 'angle', x)}
                        onEnd={() => store.endSession(`bl:${j}:angle`)}
                      />
                      <button type="button" className="del" aria-label="Убрать нагрузку" onClick={() => store.removeBeamLoad(j)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="gaddbload" onClick={store.addBeamLoad}>
                    + нагрузка
                  </button>
                </div>
                <p className="empty">Сила приложена в точке оси балки x; угол — к оси x (270° — вниз).</p>
              </>
            )}
            {st.kind === 'chain' && (
              <div className="asteps">
                <Num id="g-L" label="Пролёт L" unit="м" value={st.chain.L} onType={(x) => store.typeChain('L', x)} onEnd={() => store.endSession('chain:L')} />
                <Num
                  id="g-f"
                  label="Стрела провисания f"
                  unit="м"
                  value={st.chain.f}
                  onType={(x) => store.typeChain('f', x)}
                  onEnd={() => store.endSession('chain:f')}
                />
                <Num
                  id="g-q"
                  label="Нагрузка q"
                  unit="т/м"
                  value={st.chain.q}
                  onType={(x) => store.typeChain('q', x)}
                  onEnd={() => store.endSession('chain:q')}
                />
                <Num
                  id="g-k"
                  label="Число цепей"
                  value={st.chain.chains}
                  onType={(x) => store.typeChain('chains', Math.max(1, Math.round(x)))}
                  onEnd={() => store.endSession('chain:chains')}
                />
                <Num
                  id="g-n"
                  label="Участков (чётное)"
                  value={st.chain.n}
                  onType={(x) => store.typeChain('n', Math.min(60, Math.max(2, Math.round(x / 2) * 2)))}
                  onEnd={() => store.endSession('chain:n')}
                />
              </div>
            )}
            {preset?.note && <p className="empty">{preset.note}</p>}
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="gsolution">
              <DocView doc={model.doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Графическая статика · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={model.a.viewBox} dangerouslySetInnerHTML={{ __html: model.a.svg }} />
            <figcaption>{model.aLabel}</figcaption>
          </figure>
          {model.b && (
            <figure>
              <svg viewBox={model.b.viewBox} dangerouslySetInnerHTML={{ __html: model.b.svg }} />
              <figcaption>{model.bLabel}</figcaption>
            </figure>
          )}
        </section>
        <section className="pr-sec">
          <h2>Решение</h2>
          <DocView doc={model.doc} />
        </section>
      </article>
    </>
  );
}
