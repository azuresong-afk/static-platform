/** Экран «Удар и колебания»: груз на упругом элементе — свободные, затухающие, вынужденные колебания, сухое трение, удар. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderOsc } from '../draw/osc';
import { BEAM_SCHEMES, type BeamScheme, type ElemKind } from '../model/elastic';
import {
  FORCE_LABEL,
  LEN_LABEL,
  singleElem,
  solveOsc,
  type DampMode,
  type ForceMode,
  type ForceUnit,
  type InitMode,
  type LenUnit,
  type Orient,
  type StiffMode,
} from '../model/osc';
import { OSC_PRESETS, type OscPresetKey } from '../presets';
import { oscDoc, unitsOf } from '../text/solution';
import type { OscStore } from './store';

const ORIENT: [Orient, string][] = [
  ['v', 'вертикально (ось x вниз)'],
  ['h', 'по гладкой горизонтали (ось x вправо)'],
  ['incl', 'по наклонной плоскости (ось x вниз по уклону)'],
];
const STIFF: [StiffMode, string][] = [
  ['c', 'жёсткость c задана'],
  ['static', 'по статической деформации δст'],
  ['period', 'по измеренному периоду колебаний'],
  ['elems', 'собрать из пружин, стержней и балок'],
];
const DAMP: [DampMode, string][] = [
  ['none', 'нет'],
  ['b', 'вязкое: R = −b·v'],
  ['n', 'задан коэффициент затухания n'],
  ['ratio', 'амплитуда уменьшилась в q раз за N колебаний'],
  ['T1', 'задан период затухающих колебаний T₁'],
  ['dry', 'сухое трение о плоскость'],
];
const EXC: [ForceMode, string][] = [
  ['none', 'нет'],
  ['H', 'сила H sin(pt + δ)'],
  ['rotor', 'неуравновешенный ротор: H = m₀ e p²'],
  ['base', 'точка крепления движется: ξ = a sin(pt + δ)'],
];
const INIT: [InitMode, string][] = [
  ['eq', 'смещение x₀ от положения равновесия'],
  ['lambda', 'начальная деформация элемента λ₀ (0 — не деформирован)'],
  ['load', 'было равновесие под другой нагрузкой (груз сняли или добавили)'],
  ['drop', 'груз падает с высоты h на элемент (удар)'],
];
const KINDS: [ElemKind, string][] = [
  ['spring', 'пружина'],
  ['rod', 'стержень (растяжение-сжатие)'],
  ['beam', 'балка (изгиб)'],
];

export function OscView({ chrome, store }: { chrome: Chrome; store: OscStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const out = useMemo(() => {
    const r = solveOsc(pr);
    return { fig: renderOsc(pr, r.ok ? r : null), doc: oscDoc(pr, r, { explain: st.explain }) };
  }, [pr, st.explain]);
  const end = (k: string) => () => store.endSession(k);
  const U = unitsOf(pr);
  const el = pr.el;
  const one = singleElem(pr);
  const W = pr.byWeight ? U.F : 'кг';

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Удар и колебания</h1>
            <p className="lede">
              Груз на упругом элементе: свободные, затухающие и вынужденные колебания, резонанс, сухое трение; удар падающего груза и коэффициент динамичности.
              Упругий элемент — пружины, стержни, балки в любом сочетании.
            </p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="opreset" value={st.preset} onChange={(ev) => store.loadPreset(ev.target.value as OscPresetKey)}>
                <PresetOptions items={taskEntries(OSC_PRESETS)} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />
        <section className="sheet" aria-label="Схема и график">
          <div className="bar">
            <span className="hint">x — смещение груза от положения статического равновесия; «+» — по оси на схеме.</span>
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
              id="osvg"
              className="sketch"
              viewBox={out.fig.viewBox}
              role="img"
              aria-label="Схема системы и график x(t)"
              dangerouslySetInnerHTML={{ __html: out.fig.svg }}
            />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Единицы</h2>
            <div className="cgpar cg0">
              <label className="sfield">
                <span>длина</span>
                <select id="olen" value={pr.len} onChange={(ev) => store.setUnits(ev.target.value as LenUnit, pr.force)}>
                  {(Object.keys(LEN_LABEL) as LenUnit[]).map((k) => (
                    <option key={k} value={k}>
                      {LEN_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sfield">
                <span>сила</span>
                <select id="oforce" value={pr.force} onChange={(ev) => store.setUnits(pr.len, ev.target.value as ForceUnit)}>
                  {(Object.keys(FORCE_LABEL) as ForceUnit[]).map((k) => (
                    <option key={k} value={k}>
                      {FORCE_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <Num id="o-g" label="g, м/с²" value={pr.gms} onType={(v) => store.typeTop('gms', v)} onEnd={end('top:gms')} />
            </div>
            <p className="empty">
              Все величины — в выбранных единицах: жёсткость {U.c}, модуль упругости {U.s}, скорость {U.L}/с.
            </p>

            <h2>Груз</h2>
            <label className="toggle">
              <input type="checkbox" id="oweight" checked={pr.byWeight} onChange={(ev) => store.setByWeight(ev.target.checked)} />
              Задан вес P (m = P/g)
            </label>
            <div className="cgpar cg0">
              <Num id="o-m" label={pr.byWeight ? `вес P, ${U.F}` : 'масса m, кг'} value={pr.m} onType={(v) => store.typeTop('m', v)} onEnd={end('top:m')} />
              <Num id="o-Q" label={`постоянная сила Q, ${U.F}`} value={pr.Q} neg zero onType={(v) => store.typeTop('Q', v)} onEnd={end('top:Q')} />
            </div>
            <label className="field">
              <span>Движение</span>
              <select id="oorient" value={pr.orient} onChange={(ev) => store.setOrient(ev.target.value as Orient)}>
                {ORIENT.map(([k, t]) => (
                  <option key={k} value={k}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {pr.orient === 'incl' && (
              <div className="cgpar cg0">
                <Num id="o-alpha" label="угол α к горизонту, °" value={pr.alpha} onType={(v) => store.typeTop('alpha', v)} onEnd={end('top:alpha')} />
              </div>
            )}

            <h2>Упругий элемент</h2>
            <label className="field">
              <span>Жёсткость</span>
              <select id="ostiff" value={el.mode} onChange={(ev) => store.setStiffMode(ev.target.value as StiffMode)}>
                {STIFF.map(([k, t]) => (
                  <option key={k} value={k}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {el.mode === 'c' && (
              <div className="cgpar cg0">
                <Num id="o-c" label={`c, ${U.c}`} value={el.c} onType={(v) => store.typeEl('c', v)} onEnd={end('el:c')} />
              </div>
            )}
            {el.mode === 'static' && (
              <div className="cgpar cg0">
                <Num id="o-dst" label={`δст, ${U.L}`} value={el.dst} onType={(v) => store.typeEl('dst', v)} onEnd={end('el:dst')} />
              </div>
            )}
            {el.mode === 'period' && (
              <>
                <div className="cgpar cg0">
                  <Num
                    id="o-T0"
                    label={el.T0damped ? 'период T₁, с' : 'период T₀, с'}
                    value={el.T0}
                    onType={(v) => store.typeEl('T0', v)}
                    onEnd={end('el:T0')}
                  />
                </div>
                <label className="toggle">
                  <input type="checkbox" id="oT0damped" checked={el.T0damped} onChange={(ev) => store.setT0damped(ev.target.checked)} />
                  Период измерен при сопротивлении (это T₁)
                </label>
              </>
            )}
            {el.mode === 'elems' && (
              <div className="asteps" id="ostages">
                {el.stages.map((s, i) => (
                  <div key={i} className="os-stage">
                    <div className="os-head">
                      <b>
                        {el.stages.length > 1 ? `Ступень ${i + 1}` : 'Элементы'}
                        {s.items.length > 1 && <span className="hint"> — параллельно</span>}
                      </b>
                      <button type="button" className="del" aria-label="Убрать ступень" disabled={el.stages.length <= 1} onClick={() => store.removeStage(i)}>
                        ×
                      </button>
                    </div>
                    {s.items.map((e, j) => {
                      const N = (k: 'c' | 'ang' | 'la' | 'lb' | 'E' | 'l' | 'A' | 'J' | 'a', label: string, opts: { neg?: boolean; zero?: boolean } = {}) => (
                        <Num
                          key={k}
                          id={`o-e${i}${j}-${k}`}
                          label={label}
                          value={e[k]}
                          neg={opts.neg}
                          zero={opts.zero}
                          onType={(v) => store.typeElem(i, j, k, v)}
                          onEnd={end(`elem:${i}:${j}:${k}`)}
                        />
                      );
                      return (
                        <div key={j} className="os-elem">
                          <div className="os-head">
                            <select
                              aria-label="Вид элемента"
                              id={`o-e${i}${j}-kind`}
                              value={e.kind}
                              onChange={(ev) => store.setElemKind(i, j, ev.target.value as ElemKind)}
                            >
                              {KINDS.map(([k, t]) => (
                                <option key={k} value={k}>
                                  {t}
                                </option>
                              ))}
                            </select>
                            <button type="button" className="del" aria-label="Убрать элемент" onClick={() => store.removeElem(i, j)}>
                              ×
                            </button>
                          </div>
                          {e.kind === 'beam' && (
                            <label className="field">
                              <span>Схема</span>
                              <select id={`o-e${i}${j}-scheme`} value={e.scheme} onChange={(ev) => store.setScheme(i, j, ev.target.value as BeamScheme)}>
                                {BEAM_SCHEMES.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          <div className="cgpar cg0">
                            {e.kind === 'spring' && [
                              N('c', `c, ${U.c}`),
                              N('ang', 'угол к оси x, °', { neg: true, zero: true }),
                              N('la', 'рычаг: плечо a', { zero: true }),
                              N('lb', 'плечо груза b', { zero: true }),
                            ]}
                            {e.kind === 'rod' && [N('E', `E, ${U.s}`), N('A', `A, ${U.L}²`), N('l', `l, ${U.L}`)]}
                            {e.kind === 'beam' && [
                              N('E', `E, ${U.s}`),
                              N('J', `J, ${U.L}⁴`),
                              N('l', `пролёт l, ${U.L}`),
                              ...(e.scheme === 'ss-a' || e.scheme === 'overhang' ? [N('a', `a, ${U.L}`)] : []),
                            ]}
                          </div>
                        </div>
                      );
                    })}
                    <div className="segbtns">
                      <button type="button" className="o-addelem" onClick={() => store.addElem(i)}>
                        + параллельно
                      </button>
                    </div>
                  </div>
                ))}
                <div className="segbtns">
                  <button type="button" id="oaddstage" onClick={store.addStage}>
                    + ступень последовательно
                  </button>
                </div>
              </div>
            )}
            <label className="toggle">
              <input type="checkbox" id="orope" checked={el.rope} onChange={(ev) => store.setRope(ev.target.checked)} />
              Работает только на растяжение (трос, нить)
            </label>
            {el.mode !== 'period' && (
              <div className="cgpar cg0">
                <Num
                  id="o-mEl"
                  label={`${pr.byWeight ? 'вес' : 'масса'} элемента, ${W} (0 — не учитывать)`}
                  value={el.mEl}
                  zero
                  onType={(v) => store.typeEl('mEl', v)}
                  onEnd={end('el:mEl')}
                />
                {one?.kind === 'beam' && (
                  <Num id="o-W" label={`W, ${U.L}³ (0 — без напряжений)`} value={el.W} zero onType={(v) => store.typeEl('W', v)} onEnd={end('el:W')} />
                )}
                {(one?.kind === 'rod' || one?.kind === 'beam') && (
                  <Num
                    id="o-sAllow"
                    label={`[σ], ${U.s} (0 — не проверять)`}
                    value={el.sAllow}
                    zero
                    onType={(v) => store.typeEl('sAllow', v)}
                    onEnd={end('el:sAllow')}
                  />
                )}
              </div>
            )}

            <h2>Сопротивление</h2>
            <label className="field">
              <span>Вид</span>
              <select id="odamp" value={pr.damp.mode} onChange={(ev) => store.setDampMode(ev.target.value as DampMode)}>
                {DAMP.map(([k, t]) => (
                  <option key={k} value={k}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {pr.damp.mode !== 'none' && (
              <div className="cgpar cg0">
                {pr.damp.mode === 'b' && (
                  <Num id="o-b" label={`b, ${U.b}`} value={pr.damp.b} zero onType={(v) => store.typeDamp('b', v)} onEnd={end('damp:b')} />
                )}
                {pr.damp.mode === 'n' && <Num id="o-n" label="n, с⁻¹" value={pr.damp.n} zero onType={(v) => store.typeDamp('n', v)} onEnd={end('damp:n')} />}
                {pr.damp.mode === 'ratio' && (
                  <>
                    <Num id="o-q" label="во сколько раз, q" value={pr.damp.q} onType={(v) => store.typeDamp('q', v)} onEnd={end('damp:q')} />
                    <Num id="o-N" label="за N полных колебаний" value={pr.damp.N} onType={(v) => store.typeDamp('N', v)} onEnd={end('damp:N')} />
                  </>
                )}
                {pr.damp.mode === 'T1' && <Num id="o-T1" label="T₁, с" value={pr.damp.T1} onType={(v) => store.typeDamp('T1', v)} onEnd={end('damp:T1')} />}
                {pr.damp.mode === 'dry' && (
                  <>
                    <Num id="o-f" label="f (скольжения)" value={pr.damp.f} onType={(v) => store.typeDamp('f', v)} onEnd={end('damp:f')} />
                    <Num id="o-f0" label="f₀ (покоя; 0 — как f)" value={pr.damp.f0} zero onType={(v) => store.typeDamp('f0', v)} onEnd={end('damp:f0')} />
                  </>
                )}
              </div>
            )}
            {pr.damp.mode === 'ratio' && <p className="empty">Половина колебания (размах) — N = 0,5.</p>}

            <h2>Возмущение</h2>
            <label className="field">
              <span>Вид</span>
              <select id="oexc" value={pr.exc.mode} onChange={(ev) => store.setExcMode(ev.target.value as ForceMode)}>
                {EXC.map(([k, t]) => (
                  <option key={k} value={k}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {pr.exc.mode !== 'none' && (
              <div className="cgpar cg0">
                {pr.exc.mode === 'H' && <Num id="o-H" label={`H, ${U.F}`} value={pr.exc.H} neg onType={(v) => store.typeExc('H', v)} onEnd={end('exc:H')} />}
                {pr.exc.mode === 'rotor' && (
                  <>
                    <Num
                      id="o-m0"
                      label={`${pr.byWeight ? 'вес' : 'масса'} m₀, ${W}`}
                      value={pr.exc.m0}
                      onType={(v) => store.typeExc('m0', v)}
                      onEnd={end('exc:m0')}
                    />
                    <Num id="o-e" label={`эксцентриситет e, ${U.L}`} value={pr.exc.e} onType={(v) => store.typeExc('e', v)} onEnd={end('exc:e')} />
                  </>
                )}
                {pr.exc.mode === 'base' && <Num id="o-a" label={`a, ${U.L}`} value={pr.exc.a} neg onType={(v) => store.typeExc('a', v)} onEnd={end('exc:a')} />}
                <Num id="o-p" label="p, с⁻¹" value={pr.exc.p} onType={(v) => store.typeExc('p', v)} onEnd={end('exc:p')} />
                <Num id="o-delta" label="δ, °" value={pr.exc.delta} neg zero onType={(v) => store.typeExc('delta', v)} onEnd={end('exc:delta')} />
              </div>
            )}
            {pr.exc.mode !== 'none' && <p className="empty">Частота в оборотах: p = πn/30 (n — об/мин).</p>}

            <h2>Начальные условия</h2>
            <label className="field">
              <span>Положение</span>
              <select id="oinit" value={pr.init.mode} onChange={(ev) => store.setInitMode(ev.target.value as InitMode)}>
                {INIT.map(([k, t]) => (
                  <option key={k} value={k}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <div className="cgpar cg0">
              {pr.init.mode === 'eq' && (
                <Num id="o-x0" label={`x₀, ${U.L}`} value={pr.init.x0} neg zero onType={(v) => store.typeInit('x0', v)} onEnd={end('init:x0')} />
              )}
              {pr.init.mode === 'lambda' && (
                <Num
                  id="o-lambda0"
                  label={`λ₀, ${U.L}`}
                  value={pr.init.lambda0}
                  neg
                  zero
                  onType={(v) => store.typeInit('lambda0', v)}
                  onEnd={end('init:lambda0')}
                />
              )}
              {pr.init.mode === 'load' && (
                <Num
                  id="o-Fprev"
                  label={`прежняя нагрузка вдоль оси, ${U.F}`}
                  value={pr.init.Fprev}
                  neg
                  zero
                  onType={(v) => store.typeInit('Fprev', v)}
                  onEnd={end('init:Fprev')}
                />
              )}
              {pr.init.mode === 'drop' && (
                <Num id="o-h" label={`h, ${U.L}`} value={pr.init.h} zero onType={(v) => store.typeInit('h', v)} onEnd={end('init:h')} />
              )}
              <Num
                id="o-v0"
                label={pr.init.mode === 'drop' ? `скорость в начале падения, ${U.L}/с` : `v₀, ${U.L}/с`}
                value={pr.init.v0}
                neg
                zero
                onType={(v) => store.typeInit('v0', v)}
                onEnd={end('init:v0')}
              />
              <Num id="o-t" label="момент t, с" value={pr.t} zero onType={(v) => store.typeTop('t', v)} onEnd={end('top:t')} />
            </div>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(ev) => store.setExplain(ev.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="osolution">
              <DocView doc={out.doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Удар и колебания · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={out.fig.viewBox} dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
            <figcaption>Схема системы и закон движения x(t)</figcaption>
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
