/** Экран «Стержневые системы»: узел или жёсткий брус на упругих стержнях — усилия, прочность, подбор, [F], предельное состояние. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderRods } from '../draw/rods';
import { solveRods, type Ask, type BodyKind, type Support } from '../model/rods';
import { ROD_PRESETS, type RodPresetKey } from '../presets';
import { rodsDoc } from '../text/solution';
import type { LoadNum, RodNum, RodsStore } from './store';

const ASK: [Ask, string][] = [
  ['check', 'усилия, напряжения и проверка прочности'],
  ['design', 'подбор площади A по [σ]'],
  ['allow', 'допускаемая нагрузка по [σ]'],
  ['limit', 'предельная нагрузка (предельное состояние)'],
];

export function RodsView({ chrome, store }: { chrome: Chrome; store: RodsStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const out = useMemo(() => {
    const r = solveRods(pr);
    return { fig: renderRods(pr, r.ok ? r : null), doc: rodsDoc(pr, r, { explain: st.explain }) };
  }, [pr, st.explain]);
  const end = (k: string) => () => store.endSession(k);
  const bar = pr.body === 'bar';

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Стержневые системы</h1>
            <p className="lede">
              Узел или абсолютно жёсткий брус на упругих стержнях: усилия в статически неопределимых системах, нагрев и неточность изготовления, подбор площади,
              допускаемая и предельная нагрузки.
            </p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="rdpreset" value={st.preset} onChange={(ev) => store.loadPreset(ev.target.value as RodPresetKey)}>
                <PresetOptions items={taskEntries(ROD_PRESETS)} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />
        <section className="sheet" aria-label="Схема">
          <div className="bar">
            <span className="hint">Угол стержня — направление от точки крепления к неподвижному шарниру: 90° — вверх, 0° — вправо.</span>
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
              id="rdsvg"
              className="sketch"
              viewBox={out.fig.viewBox}
              role="img"
              aria-label="Схема стержневой системы"
              dangerouslySetInnerHTML={{ __html: out.fig.svg }}
            />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Система</h2>
            <label className="field">
              <span>Тело</span>
              <select id="rdbody" value={pr.body} onChange={(ev) => store.setBody(ev.target.value as BodyKind)}>
                <option value="node">узел (шарнир, в котором сходятся стержни)</option>
                <option value="bar">абсолютно жёсткий брус</option>
              </select>
            </label>
            {bar && (
              <div className="cgpar cg0">
                <Num id="rd-L" label="длина бруса, м" value={pr.L} onType={(v) => store.typeTop('L', v)} onEnd={end('top:L')} />
              </div>
            )}

            <h2>Стержни</h2>
            <div className="asteps" id="rdrods">
              {pr.rods.map((rd, i) => {
                const N = (k: RodNum, label: string, o: { neg?: boolean; zero?: boolean } = {}) => (
                  <Num
                    key={k}
                    id={`rd-r${i}-${k}`}
                    label={label}
                    value={rd[k]}
                    neg={o.neg}
                    zero={o.zero}
                    onType={(v) => store.typeRod(i, k, v)}
                    onEnd={end(`rod:${i}:${k}`)}
                  />
                );
                return (
                  <div key={i} className="rd-item">
                    <div className="os-head">
                      <b>Стержень {i + 1}</b>
                      <button type="button" className="del" aria-label="Убрать стержень" disabled={pr.rods.length <= 1} onClick={() => store.removeRod(i)}>
                        ×
                      </button>
                    </div>
                    <div className="cgpar cg0">
                      {bar && N('x', 'точка на брусе x, м', { zero: true })}
                      {N('ang', 'угол φ, °', { neg: true, zero: true })}
                      {N('l', 'длина l, м')}
                      {N('c', 'площадь: доля A')}
                      {N('E', 'E, МПа')}
                      {N('alpha', 'α, 1/К', { zero: true })}
                      {N('dT', 'нагрев ΔT, К', { neg: true, zero: true })}
                      {N('delta', 'неточность δ, мм', { neg: true, zero: true })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="segbtns">
              <button type="button" id="rdaddrod" onClick={store.addRod}>
                + стержень
              </button>
            </div>
            <p className="empty">δ &gt; 0 — стержень изготовлен длиннее проектной длины, δ &lt; 0 — короче (зазор).</p>

            {bar && (
              <>
                <h2>Опоры бруса</h2>
                <div className="asteps" id="rdsups">
                  {pr.supports.map((sp, j) => (
                    <div key={j} className="rd-item">
                      <div className="os-head">
                        <select aria-label="Вид опоры" value={sp.kind} onChange={(ev) => store.setSupportKind(j, ev.target.value as Support['kind'])}>
                          <option value="pin">шарнирно-неподвижная опора {'ABCDEFGH'[j]}</option>
                          <option value="roller">каток {'ABCDEFGH'[j]}</option>
                        </select>
                        <button type="button" className="del" aria-label="Убрать опору" onClick={() => store.removeSupport(j)}>
                          ×
                        </button>
                      </div>
                      <div className="cgpar cg0">
                        <Num id={`rd-s${j}-x`} label="x, м" value={sp.x} zero onType={(v) => store.typeSupport(j, 'x', v)} onEnd={end(`sup:${j}:x`)} />
                        {sp.kind === 'roller' && (
                          <Num
                            id={`rd-s${j}-ang`}
                            label="направление реакции, °"
                            value={sp.ang}
                            neg
                            zero
                            onType={(v) => store.typeSupport(j, 'ang', v)}
                            onEnd={end(`sup:${j}:ang`)}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="rdaddpin" onClick={() => store.addSupport('pin')}>
                    + шарнир
                  </button>
                  <button type="button" id="rdaddroller" onClick={() => store.addSupport('roller')}>
                    + каток
                  </button>
                </div>
              </>
            )}

            <h2>Нагрузки</h2>
            <div className="asteps" id="rdloads">
              {pr.loads.map((ld, j) => {
                const N = (k: LoadNum, label: string, o: { neg?: boolean; zero?: boolean } = {}) => (
                  <Num
                    key={k}
                    id={`rd-l${j}-${k}`}
                    label={label}
                    value={ld[k]}
                    neg={o.neg}
                    zero={o.zero}
                    onType={(v) => store.typeLoad(j, k, v)}
                    onEnd={end(`load:${j}:${k}`)}
                  />
                );
                return (
                  <div key={j} className="rd-item">
                    <div className="os-head">
                      <b>{ld.kind === 'F' ? 'Сила' : ld.kind === 'M' ? 'Пара сил' : 'Равномерная нагрузка (вниз)'}</b>
                      <button type="button" className="del" aria-label="Убрать нагрузку" onClick={() => store.removeLoad(j)}>
                        ×
                      </button>
                    </div>
                    <div className="cgpar cg0">
                      {ld.kind === 'F' && [
                        N('F', 'F, кН', { neg: true, zero: true }),
                        N('ang', 'направление, °', { neg: true, zero: true }),
                        ...(bar ? [N('x', 'x, м', { zero: true })] : []),
                      ]}
                      {ld.kind === 'M' && [N('F', 'M, кН·м (+ против часовой)', { neg: true, zero: true })]}
                      {ld.kind === 'q' && [N('F', 'q, кН/м', { neg: true, zero: true }), N('x', 'от x₁, м', { zero: true }), N('x2', 'до x₂, м')]}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="segbtns">
              <button type="button" id="rdaddF" onClick={() => store.addLoad('F')}>
                + сила
              </button>
              {bar && (
                <>
                  <button type="button" id="rdaddM" onClick={() => store.addLoad('M')}>
                    + пара
                  </button>
                  <button type="button" id="rdaddq" onClick={() => store.addLoad('q')}>
                    + распределённая
                  </button>
                </>
              )}
            </div>
            <p className="empty">Направление силы — угол от оси x против часовой стрелки: 270° — вниз.</p>

            <h2>Что найти</h2>
            <label className="field">
              <span>Вопрос</span>
              <select id="rdask" value={pr.ask} onChange={(ev) => store.setAsk(ev.target.value as Ask)}>
                {ASK.map(([k, t]) => (
                  <option key={k} value={k}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <div className="cgpar cg0">
              {pr.ask !== 'design' && <Num id="rd-A" label="площадь A, см²" value={pr.A} onType={(v) => store.typeTop('A', v)} onEnd={end('top:A')} />}
              <Num
                id="rd-sAllow"
                label={pr.ask === 'limit' ? '[σ], МПа (0 — σт/n)' : '[σ], МПа'}
                value={pr.sAllow}
                zero
                onType={(v) => store.typeTop('sAllow', v)}
                onEnd={end('top:sAllow')}
              />
              <Num id="rd-sT" label="σт, МПа" value={pr.sT} zero onType={(v) => store.typeTop('sT', v)} onEnd={end('top:sT')} />
              {pr.ask === 'limit' && <Num id="rd-n" label="запас n" value={pr.n} onType={(v) => store.typeTop('n', v)} onEnd={end('top:n')} />}
            </div>
            {(pr.ask === 'allow' || pr.ask === 'limit') && (
              <p className="empty">Нагрузки увеличиваются пропорционально; если задать F = 1 кН, найденный множитель и есть [F] в кН.</p>
            )}
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(ev) => store.setExplain(ev.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="rdsolution">
              <DocView doc={out.doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Стержневые системы · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={out.fig.viewBox} dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
            <figcaption>Схема и план перемещений</figcaption>
          </figure>
        </section>
        <section className="pr-sec">
          <h2>Решение</h2>
          <DocView doc={out.doc} />
        </section>
      </article>
    </>
  );
}
