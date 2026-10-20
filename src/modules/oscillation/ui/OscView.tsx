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
import { renderResonance } from '../draw/resonance';
import { BEAM_SCHEMES, type BeamScheme, type ElemKind } from '../model/elastic';
import { INV_TARGET, INV_UNKNOWN, solveExperiment, solveInverse, type InvKind, type InvTarget, type InvUnknown } from '../model/inverse';
import { resonanceOf } from '../model/resonance';
import { expStep, invStep } from '../text/inverse';
import {
  FORCE_LABEL,
  HARMONIC,
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
  ['two', 'две гармоники: H₁ sin(p₁t + δ₁) + H₂ sin(p₂t + δ₂)'],
  ['rotor', 'неуравновешенный ротор: H = m₀ e p²'],
  ['base', 'точка крепления движется: ξ = a sin(pt + δ)'],
  ['support', 'основание движется (виброграф, сейсмограф, торсиограф): x — относительно основания'],
  ['ramp', 'сила растёт со временем: F = a·t'],
  ['exp', 'сила убывает: F = F₀e^{−βt}'],
  ['pulse', 'постоянная сила F действует время τ'],
  ['ramphold', 'сила растёт до F₀ за время τ и остаётся постоянной'],
  ['cam', 'кулачок: ξ = a(1 − cos ωt) на одном обороте, дальше ξ = 0'],
];
const INV_KINDS: [InvKind, string][] = [
  ['param', 'найти параметр системы по измеренной величине'],
  ['jref', 'момент инерции по периодам: эталонный диск (37.17)'],
  ['jadd', 'момент инерции по периодам: диск добавлен к телу (37.18)'],
  ['g2', 'ускорение g по двум опытам (32.47)'],
  ['bifilar', 'бифилярный подвес (37.19)'],
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

const fmtRoot = (x: number) => String(Number(x.toPrecision(6)));

export function OscView({ chrome, store }: { chrome: Chrome; store: OscStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const iv = st.inv;
  const out = useMemo(() => {
    // Обратная задача: найденное значение подставляется в копию задачи, по ней и строятся схема, график и решение.
    const invRes = iv.on && iv.kind === 'param' ? solveInverse(pr, iv) : null;
    const eff = invRes?.ok ? invRes.problem! : pr;
    const r = solveOsc(eff);
    const doc = oscDoc(eff, r, { explain: st.explain });
    if (invRes) doc.steps.unshift(invStep(pr, iv, invRes));
    else if (iv.on) doc.steps = [expStep(pr, iv, solveExperiment(pr, iv))];
    const rs = r.ok && HARMONIC.includes(eff.exc.mode) ? resonanceOf(r, eff.exc.mode as 'H' | 'rotor' | 'base' | 'support' | 'two') : null;
    return { fig: renderOsc(eff, r.ok ? r : null), doc, invRes, res: rs ? renderResonance(rs) : null };
  }, [pr, iv, st.explain]);
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
              Груз на упругом элементе: свободные, затухающие и вынужденные колебания, резонанс, сухое трение; удар падающего груза и коэффициент динамичности;
              силы общего вида, движение основания, обратные задачи и резонансная кривая. Упругий элемент — пружины, стержни, балки в любом сочетании.
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
        {out.res && (
          <section className="sheet" aria-label="Резонансная кривая">
            <div className="bar">
              <span className="hint">Резонансная кривая: амплитуда вынужденных колебаний и сдвиг фазы в зависимости от частоты возмущения.</span>
            </div>
            <div className="canvas">
              <svg
                id="ores"
                className="sketch"
                viewBox={out.res.viewBox}
                role="img"
                aria-label="Резонансная кривая"
                dangerouslySetInnerHTML={{ __html: out.res.svg }}
              />
            </div>
          </section>
        )}
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
                      const N = (
                        k: 'c' | 'ang' | 'la' | 'lb' | 'E' | 'l' | 'A' | 'J' | 'a' | 'cs',
                        label: string,
                        opts: { neg?: boolean; zero?: boolean } = {},
                      ) => (
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
                            {e.kind === 'rod' && [
                              N('E', `E, ${U.s}`),
                              N('A', `A, ${U.L}²`),
                              N('l', `l, ${U.L}`),
                              N('cs', `пружина последовательно, ${U.c} (0 — нет)`, { zero: true }),
                            ]}
                            {e.kind === 'beam' && [
                              N('E', `E, ${U.s}`),
                              N('J', `J, ${U.L}⁴`),
                              N('l', `пролёт l, ${U.L}`),
                              ...(e.scheme === 'ss-a' || e.scheme === 'overhang' ? [N('a', `a, ${U.L}`)] : []),
                              N('cs', `пружина под опорой, ${U.c} (0 — нет)`, { zero: true }),
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
                  <>
                    <Num id="o-b" label={`b, ${U.b}`} value={pr.damp.b} zero onType={(v) => store.typeDamp('b', v)} onEnd={end('damp:b')} />
                    <Num id="o-dla" label="рычаг демпфера: плечо a" value={pr.damp.la} zero onType={(v) => store.typeDamp('la', v)} onEnd={end('damp:la')} />
                    <Num
                      id="o-dlb"
                      label="плечо груза b (0 — без рычага)"
                      value={pr.damp.lb}
                      zero
                      onType={(v) => store.typeDamp('lb', v)}
                      onEnd={end('damp:lb')}
                    />
                  </>
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
                {(pr.exc.mode === 'H' || pr.exc.mode === 'two') && (
                  <Num
                    id="o-H"
                    label={pr.exc.mode === 'two' ? `H₁, ${U.F}` : `H, ${U.F}`}
                    value={pr.exc.H}
                    neg
                    onType={(v) => store.typeExc('H', v)}
                    onEnd={end('exc:H')}
                  />
                )}
                {pr.exc.mode === 'ramp' && (
                  <Num id="o-H" label={`a, ${U.F}/с`} value={pr.exc.H} neg onType={(v) => store.typeExc('H', v)} onEnd={end('exc:H')} />
                )}
                {(pr.exc.mode === 'exp' || pr.exc.mode === 'pulse' || pr.exc.mode === 'ramphold') && (
                  <Num
                    id="o-H"
                    label={`${pr.exc.mode === 'pulse' ? 'F' : 'F₀'}, ${U.F}`}
                    value={pr.exc.H}
                    neg
                    onType={(v) => store.typeExc('H', v)}
                    onEnd={end('exc:H')}
                  />
                )}
                {pr.exc.mode === 'exp' && (
                  <Num id="o-beta" label="β, с⁻¹" value={pr.exc.beta} zero onType={(v) => store.typeExc('beta', v)} onEnd={end('exc:beta')} />
                )}
                {(pr.exc.mode === 'pulse' || pr.exc.mode === 'ramphold') && (
                  <Num id="o-tau" label="τ, с" value={pr.exc.tau} onType={(v) => store.typeExc('tau', v)} onEnd={end('exc:tau')} />
                )}
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
                {(pr.exc.mode === 'base' || pr.exc.mode === 'support' || pr.exc.mode === 'cam') && (
                  <Num id="o-a" label={`a, ${U.L}`} value={pr.exc.a} neg onType={(v) => store.typeExc('a', v)} onEnd={end('exc:a')} />
                )}
                {pr.exc.mode === 'support' && (
                  <Num
                    id="o-mc"
                    label={`${pr.byWeight ? 'вес' : 'масса'} в переносном движении, ${W} (0 — весь груз)`}
                    value={pr.exc.mc}
                    zero
                    onType={(v) => store.typeExc('mc', v)}
                    onEnd={end('exc:mc')}
                  />
                )}
                {pr.exc.mode === 'cam' && (
                  <Num
                    id="o-c1"
                    label={`c₁ пружины кулачка, ${U.c} (входит в c)`}
                    value={pr.exc.c1}
                    onType={(v) => store.typeExc('c1', v)}
                    onEnd={end('exc:c1')}
                  />
                )}
                {(HARMONIC.includes(pr.exc.mode) || pr.exc.mode === 'cam') && (
                  <Num
                    id="o-p"
                    label={pr.exc.mode === 'cam' ? 'ω кулачка, с⁻¹' : pr.exc.mode === 'two' ? 'p₁, с⁻¹' : 'p, с⁻¹'}
                    value={pr.exc.p}
                    onType={(v) => store.typeExc('p', v)}
                    onEnd={end('exc:p')}
                  />
                )}
                {HARMONIC.includes(pr.exc.mode) && (
                  <Num
                    id="o-delta"
                    label={pr.exc.mode === 'two' ? 'δ₁, °' : 'δ, °'}
                    value={pr.exc.delta}
                    neg
                    zero
                    onType={(v) => store.typeExc('delta', v)}
                    onEnd={end('exc:delta')}
                  />
                )}
                {pr.exc.mode === 'two' && (
                  <>
                    <Num id="o-H2" label={`H₂, ${U.F}`} value={pr.exc.H2} neg onType={(v) => store.typeExc('H2', v)} onEnd={end('exc:H2')} />
                    <Num id="o-p2" label="p₂, с⁻¹" value={pr.exc.p2} onType={(v) => store.typeExc('p2', v)} onEnd={end('exc:p2')} />
                    <Num id="o-delta2" label="δ₂, °" value={pr.exc.delta2} neg zero onType={(v) => store.typeExc('delta2', v)} onEnd={end('exc:delta2')} />
                  </>
                )}
                {HARMONIC.includes(pr.exc.mode) && (
                  <Num
                    id="o-L"
                    label={`длина между толчками L, ${U.L} (0 — не нужна)`}
                    value={pr.exc.L}
                    zero
                    onType={(v) => store.typeExc('L', v)}
                    onEnd={end('exc:L')}
                  />
                )}
              </div>
            )}
            {(HARMONIC.includes(pr.exc.mode) || pr.exc.mode === 'cam') && <p className="empty">Частота в оборотах: p = πn/30 (n — об/мин).</p>}

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

            <h2>Обратная задача</h2>
            <label className="toggle">
              <input type="checkbox" id="oinv" checked={iv.on} onChange={(ev) => store.setInvOn(ev.target.checked)} />
              Найти неизвестное по опыту или измерению
            </label>
            {iv.on && (
              <>
                <label className="field">
                  <span>Что решаем</span>
                  <select id="oinvkind" value={iv.kind} onChange={(ev) => store.setInvKind(ev.target.value as InvKind)}>
                    {INV_KINDS.map(([k, t]) => (
                      <option key={k} value={k}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                {iv.kind === 'param' && (
                  <>
                    <label className="field">
                      <span>Неизвестно</span>
                      <select id="oinvunk" value={iv.unknown} onChange={(ev) => store.setInvUnknown(ev.target.value as InvUnknown)}>
                        {(Object.keys(INV_UNKNOWN) as InvUnknown[]).map((k) => (
                          <option key={k} value={k}>
                            {INV_UNKNOWN[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Измерено</span>
                      <select id="oinvtgt" value={iv.target} onChange={(ev) => store.setInvTarget(ev.target.value as InvTarget)}>
                        {(Object.keys(INV_TARGET) as InvTarget[]).map((k) => (
                          <option key={k} value={k}>
                            {INV_TARGET[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="cgpar cg0">
                      <Num
                        id="o-invv"
                        label="значение измеренной величины"
                        value={iv.value}
                        neg
                        onType={(v) => store.typeInvValue(v)}
                        onEnd={end('inv:value')}
                      />
                    </div>
                    {out.invRes?.ok && out.invRes.roots.length > 1 && (
                      <label className="field">
                        <span>Корень</span>
                        <select id="oinvroot" value={out.invRes.pick} onChange={(ev) => store.setInvPick(Number(ev.target.value))}>
                          {out.invRes.roots.map((x, i) => (
                            <option key={i} value={i}>
                              {i + 1}: {fmtRoot(x)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {out.invRes?.ok && (
                      <div className="segbtns">
                        <button type="button" id="oinvapply" onClick={() => store.applyInv(out.invRes!.problem!)}>
                          Подставить найденное в задачу
                        </button>
                      </div>
                    )}
                    <p className="empty">
                      Решение ниже и график построены с найденным значением; при нескольких корнях (например, амплитуда до и после резонанса) выберите нужный.
                    </p>
                  </>
                )}
                {iv.kind !== 'param' && (
                  <div className="cgpar cg0">
                    {(
                      {
                        jref: [
                          ['P', `вес диска P, ${U.F}`],
                          ['r', `радиус диска r, ${U.L}`],
                          ['Tr', 'период с диском, с'],
                          ['T1', 'период тела, с'],
                        ],
                        jadd: [
                          ['P', `вес диска P, ${U.F}`],
                          ['r', `радиус диска r, ${U.L}`],
                          ['T1', 'период тела без диска, с'],
                          ['T2', 'период с диском, с'],
                        ],
                        g2: [
                          ['d1', `удлинение 1-го груза δ₁, ${U.L}`],
                          ['d2', `удлинение 2-го груза δ₂, ${U.L}`],
                          ['T1', 'период 1-го груза, с'],
                          ['T2', 'период 2-го груза, с'],
                          ['P1', `вес 1-го груза, ${U.F} (0 — не нужен)`],
                          ['P2', `вес 2-го груза, ${U.F} (0 — не нужен)`],
                        ],
                        bifilar: [
                          ['P', `вес стержня P, ${U.F}`],
                          ['a', `полудлина стержня a, ${U.L}`],
                          ['b', `полурасстояние между нитями b, ${U.L}`],
                          ['l', `длина нитей l, ${U.L}`],
                          ['Tm', 'измеренный период, с (0 — нет)'],
                        ],
                      } as Record<string, [keyof typeof iv.exp, string][]>
                    )[iv.kind].map(([k, label]) => (
                      <Num
                        key={k}
                        id={`o-x-${k}`}
                        label={label}
                        value={iv.exp[k]}
                        zero={k === 'P1' || k === 'P2' || k === 'Tm'}
                        onType={(v) => store.typeInvExp(k, v)}
                        onEnd={end(`inv:exp:${k}`)}
                      />
                    ))}
                  </div>
                )}
              </>
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
