/** Экран «Пространственный брус»: схема в аксонометрии, эпюры Q, M_изг, M_к, решение и подбор круга или кольца. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import type { ConventionsStore } from '../../../shared/conventions';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { roman } from '../../frames/model/geometry';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { ptName, renderEpure, renderScheme } from '../draw/axo';
import { solveFrame3, type Axis, type Frame3, type Load3 } from '../model/frame3d';
import { SPACE_PRESETS, type SpacePresetKey } from '../presets';
import { spaceDoc } from '../text/solution';
import type { SpaceStore } from './store';

const DIRS: { axis: Axis; sign: 1 | -1; label: string }[] = [
  { axis: 'x', sign: 1, label: '+x (вправо)' },
  { axis: 'x', sign: -1, label: '−x (влево)' },
  { axis: 'y', sign: 1, label: '+y (вглубь)' },
  { axis: 'y', sign: -1, label: '−y (к нам)' },
  { axis: 'z', sign: 1, label: '+z (вверх)' },
  { axis: 'z', sign: -1, label: '−z (вниз)' },
];
const dirKey = (a: Axis, s: number) => `${s < 0 ? '-' : '+'}${a}`;
const KIND: Record<Load3['kind'], string> = { P: 'Сила P, кН', M: 'Пара M (вектор), кН·м', q: 'Нагрузка q, кН/м' };

function Figure({ id, title, fig }: { id: string; title: string; fig: { svg: string; viewBox: string } }) {
  return (
    <figure className="sp-fig">
      <figcaption>{title}</figcaption>
      <svg id={id} viewBox={fig.viewBox} role="img" aria-label={title} dangerouslySetInnerHTML={{ __html: fig.svg }} />
    </figure>
  );
}

export function SpaceView({ chrome, store, conv }: { chrome: Chrome; store: SpaceStore; conv: ConventionsStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const c = useSyncExternalStore(conv.subscribe, conv.get);
  const fr = st.frame;
  const sol = useMemo(() => solveFrame3(fr), [fr]);
  const scheme = useMemo(() => renderScheme(fr, sol), [fr, sol]);
  const compressed = c.mSide === 'compressed';
  const figs = useMemo(
    () => ({ Q: renderEpure(sol, 'Q', compressed), Mb: renderEpure(sol, 'Mb', compressed), Mk: renderEpure(sol, 'Mk', compressed) }),
    [sol, compressed],
  );
  const doc = useMemo(() => spaceDoc(fr, sol, { explain: st.explain }), [fr, sol, st.explain]);
  const n = fr.segs.length;

  const dirSelect = (id: string, axis: Axis, sign: number, onChange: (a: Axis, s: 1 | -1) => void) => (
    <select
      id={id}
      value={dirKey(axis, sign)}
      onChange={(e) => {
        const d = DIRS.find((x) => dirKey(x.axis, x.sign) === e.target.value)!;
        onChange(d.axis, d.sign);
      }}
    >
      {DIRS.map((d) => (
        <option key={dirKey(d.axis, d.sign)} value={dirKey(d.axis, d.sign)}>
          {d.label}
        </option>
      ))}
    </select>
  );
  const figsBlock = (
    <>
      <Figure id="sscheme" title="Расчётная схема" fig={scheme} />
      <Figure id="sQ" title="Эпюры поперечных сил Q, кН" fig={figs.Q} />
      <Figure id="sMb" title={`Эпюры изгибающих моментов, кН·м (на ${compressed ? 'сжатых' : 'растянутых'} волокнах)`} fig={figs.Mb} />
      <Figure id="sMk" title="Эпюра крутящего момента Mк, кН·м" fig={figs.Mk} />
    </>
  );

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Пространственный брус</h1>
            <p className="lede">Ломаный брус-консоль в пространстве: эпюры поперечных сил, изгибающих и крутящих моментов, опасное сечение по гипотезе прочности, диаметр круга или кольца.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="spreset3" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as SpacePresetKey)}>
                {(Object.keys(SPACE_PRESETS) as SpacePresetKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SPACE_PRESETS[k].title}
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
        <Notice notice={st.notice} onClose={store.closeNotice} />

        <section className="sheet" aria-label="Схема и эпюры">
          <div className="bar">
            <span className="hint">Оси: x — вправо, y — вглубь, z — вверх. Сторона эпюры изгибающих моментов — как в «Изгибе» (правила и обозначения).</span>
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
          <div className="canvas sp-figs">{figsBlock}</div>
        </section>

        <div className="cols">
          <section className="panel conv" aria-label="Брус">
            <h2>Брус</h2>
            <div className="sub">Участки от заделки {ptName(0)} к свободному концу</div>
            <div className="asteps">
              {fr.segs.map((s, i) => (
                <div className="srow" key={i}>
                  <span className="segname">
                    {ptName(i)}–{ptName(i + 1)}
                  </span>
                  {dirSelect(`s3-dir${i}`, s.axis, s.sign, (a, sg) => store.setSegDir(i, a, sg))}
                  <Num id={`s3-l${i}`} label="" unit="м" value={s.l} onType={(v) => store.typeSegLen(i, v)} onEnd={() => store.endSession(`seg:${i}`)} />
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="s3add" onClick={store.addSeg}>
                + участок
              </button>
              <button type="button" disabled={n <= 1} onClick={store.removeSeg}>
                − последний участок
              </button>
            </div>
            <div className="sub">Нагрузки</div>
            <div className="asteps">
              {fr.loads.map((l, i) => (
                <div className="lrow" key={i}>
                  <span className="lkind">{KIND[l.kind]}</span>
                  <select value={l.kind === 'q' ? l.seg : l.node} onChange={(e) => store.setLoad(i, { where: +e.target.value })} aria-label="Где приложена">
                    {l.kind === 'q'
                      ? fr.segs.map((_, j) => (
                          <option key={j} value={j}>
                            участок {roman(j)}
                          </option>
                        ))
                      : fr.segs.map((_, j) => (
                          <option key={j} value={j + 1}>
                            точка {ptName(j + 1)}
                          </option>
                        ))}
                  </select>
                  {dirSelect(`s3-ld${i}`, l.axis, l.v, (a, sg) => store.setLoad(i, { axis: a, dir: sg }))}
                  <Num id={`s3-v${i}`} label="" value={Math.abs(l.v)} onType={(v) => store.typeLoadValue(i, v)} onEnd={() => store.endSession(`load:${i}`)} />
                  <button type="button" className="del" aria-label="Убрать нагрузку" onClick={() => store.removeLoad(i)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" onClick={() => store.addLoad('P')}>
                + сила
              </button>
              <button type="button" onClick={() => store.addLoad('M')}>
                + пара
              </button>
              <button type="button" onClick={() => store.addLoad('q')}>
                + нагрузка q
              </button>
            </div>
            <div className="sub">Сечение и прочность</div>
            {(['circle', 'ring'] as Frame3['section'][]).map((s) => (
              <label className="opt" key={s}>
                <input type="radio" name="s3-section" checked={fr.section === s} onChange={() => store.setField('section', s)} />
                <span>{s === 'circle' ? 'круг (А)' : 'кольцо (Б)'}</span>
              </label>
            ))}
            {([3, 4] as const).map((h) => (
              <label className="opt" key={h}>
                <input type="radio" name="s3-hyp" checked={fr.hyp === h} onChange={() => store.setField('hyp', h)} />
                <span>{h === 3 ? 'третья гипотеза прочности (наибольших касательных напряжений)' : 'четвёртая (энергетическая) гипотеза'}</span>
              </label>
            ))}
            <div className="sgrid">
              {fr.section === 'ring' && <Num id="s3-c" label="d/D кольца" value={fr.c} onType={(v) => v < 1 && store.typeField('c', v)} onEnd={() => store.endSession('c')} />}
              <Num id="s3-sigma" label="[σ]" unit="МПа" value={fr.sigma} onType={(v) => store.typeField('sigma', v)} onEnd={() => store.endSession('sigma')} />
            </div>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="s3solution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Пространственный брус · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs sp-print">
          {(
            [
              ['Расчётная схема', scheme],
              ['Эпюры Q, кН', figs.Q],
              ['Эпюры изгибающих моментов, кН·м', figs.Mb],
              ['Эпюра Mк, кН·м', figs.Mk],
            ] as const
          ).map(([t, fig]) => (
            <figure key={t}>
              <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: fig.svg }} />
              <figcaption>{t}</figcaption>
            </figure>
          ))}
        </section>
        <section className="pr-sec">
          <h2>Решение</h2>
          <DocView doc={doc} />
        </section>
      </article>
    </>
  );
}
