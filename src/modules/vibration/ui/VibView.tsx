/**
 * Экран «Колебания систем»: система по T и Π, цепочка тел, балка с грузами или гаситель; возмущающая сила;
 * схема с формами главных колебаний, графики и решение по шагам.
 */
import { useMemo, useState, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { normName, parseSym, type SymContext } from '../../../shared/sym';
import { taskEntries } from '../../../shared/tasks';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderVib } from '../draw/vib';
import { linkStiffness, MAX_DOF, solveVib, type ChainSys, type ForceKind, type VibProblem } from '../model/vibration';
import { ExtraScreen } from '../../../shared/ui/ExtraScreen';
import { VIB_ASKS } from '../model/extra';
import { VIB_EXTRA_PRESETS, type VibExtraKey } from '../extraPresets';
import { VIB_PRESETS, type VibPresetKey } from '../presets';
import { vibDoc } from '../text/solution';
import type { VibStore } from './store';

/** Поле формулы: ошибка разбора подсвечивается, неверная формула не применяется. */
function SymField({
  id,
  label,
  value,
  ctx,
  onType,
  onEnd,
  err,
  wide = true,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  ctx: SymContext;
  onType: (s: string) => void;
  onEnd: () => void;
  err?: string;
  wide?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? value;
  const r = parseSym(shown, ctx);
  const msg = !r.ok ? r.error : err;
  return (
    <label className={wide ? 'sfield lg-formula' : 'sfield'}>
      <span>{label}</span>
      <span className="inp">
        <input
          id={id}
          type="text"
          spellCheck={false}
          className={msg ? 'bad' : undefined}
          title={msg}
          value={shown}
          placeholder={placeholder ?? 'пусто — 0'}
          onChange={(e) => {
            setText(e.target.value);
            if (parseSym(e.target.value, ctx).ok) onType(e.target.value);
          }}
          onBlur={() => {
            setText(null);
            onEnd();
          }}
        />
      </span>
      {msg && <small className="lg-err">{msg}</small>}
    </label>
  );
}

const SRC_T: Record<VibProblem['src'], string> = {
  energy: 'система по T и Π (уравнения Лагранжа)',
  chain: 'цепочка тел: пружины, вал с дисками, нить с грузами',
  beam: 'грузы на балке (коэффициенты влияния)',
  absorber: 'динамический гаситель колебаний',
};
const KIND_T: Record<ChainSys['kind'], string> = { spring: 'грузы на пружинах', shaft: 'диски на валу (кручение)', string: 'грузы на натянутой нити' };
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sb = (i: number) => String(i).replace(/\d/g, (x) => SUB[+x]);

const ALL_PRESETS = { ...VIB_PRESETS, ...VIB_EXTRA_PRESETS };

export function VibView({ chrome, store }: { chrome: Chrome; store: VibStore }) {
  const view = useSyncExternalStore(store.subscribe, () => store.get().view);
  if (view === 'extra')
    return (
      <ExtraScreen
        chrome={chrome}
        host={store.xhost}
        asks={VIB_ASKS}
        presets={ALL_PRESETS}
        prefix="vb"
        heading="Колебания систем: приближённые формулы, условия в буквах, уравнения движения"
        lede="Задачи §54, где нужен вывод, а не только числа: стержень на нити при малом отношении длин, условие равенства главных частот, положение равновесия перед малыми колебаниями, уравнения движения при произвольном движении платформы и для крутильной системы с маятниковым гасителем."
        mainLabel="система по T и Π, цепочка, балка, гаситель"
        tabName="Колебания систем"
      />
    );
  return <VibViewMain chrome={chrome} store={store} />;
}

function VibViewMain({ chrome, store }: { chrome: Chrome; store: VibStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const r = useMemo(() => solveVib(pr), [pr]);
  const fig = useMemo(() => renderVib(pr, r), [pr, r]);
  const doc = useMemo(() => vibDoc(pr, r, { explain: st.explain }), [pr, r, st.explain]);
  const end = (k: string) => () => store.endSession(k);
  const err = (field: string) => (!r.ok && r.field === field ? r.error : undefined);
  const note = st.preset !== 'custom' ? ALL_PRESETS[st.preset].note : null;
  const E = pr.energy,
    C = pr.chain,
    B = pr.beam,
    A = pr.absorber;
  const ctx: SymContext = { coords: E.coords.map((c) => normName(c.name.trim())), params: E.params.map((p) => normName(p.name.trim())) };
  /** Числовое поле, привязанное к пути в задаче. */
  const N = (key: string, label: string, value: number, set: (p: VibProblem, v: number) => void, kind: 'any' | 'pos' | 'nonneg' = 'any', unit?: string) => (
    <Num
      key={key}
      id={`vb-${key}`}
      label={label}
      unit={unit}
      value={value}
      neg={kind === 'any'}
      zero={kind !== 'pos'}
      onType={(v) => store.type(key, (p) => set(p, v))}
      onEnd={end(key)}
    />
  );
  const forceOn = pr.force.kind !== 'none';
  const m = C.kind === 'shaft' ? 'J' : 'm';

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Колебания систем</h1>
            <p className="lede">
              Малые колебания с несколькими степенями свободы: частоты и формы главных колебаний, главные координаты, движение по начальным условиям,
              коэффициенты влияния балок, вынужденные колебания и динамический гаситель (Мещерский, §54).
            </p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="vbpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as VibPresetKey | VibExtraKey)}>
                <PresetOptions items={taskEntries(ALL_PRESETS)} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
            <div className="segbtns">
              <button type="button" id="vbto-extra" onClick={() => store.xhost.setView('extra')}>
                Приближённые формулы, равновесие, уравнения движения →
              </button>
            </div>
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />

        <section className="sheet" aria-label="Схема и формы колебаний">
          <div className="bar">
            <span className="hint">
              {note ?? 'Схема, формы главных колебаний (амплитуды при первой ненулевой, равной 1), графики движения и амплитуд вынужденных колебаний.'}
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
          <div className="canvas lg-canvas">
            <svg id="vbsvg" viewBox={fig.viewBox} role="img" aria-label="Схема и формы колебаний" dangerouslySetInnerHTML={{ __html: fig.svg }} />
          </div>
        </section>

        <div className="cols">
          <section className="panel conv" aria-label="Система">
            <h2>Система</h2>
            <label className="field">
              <span>Как задана система</span>
              <select id="vbsrc" value={pr.src} onChange={(e) => store.act((p) => (p.src = e.target.value as VibProblem['src']))}>
                {(Object.keys(SRC_T) as VibProblem['src'][]).map((k) => (
                  <option key={k} value={k}>
                    {SRC_T[k]}
                  </option>
                ))}
              </select>
            </label>

            {pr.src === 'energy' && (
              <>
                <div className="sub">Обобщённые координаты (отсчёт — от положения равновесия q*)</div>
                <div id="vbcoords">
                  {E.coords.map((c, i) => (
                    <div className="vb-item" key={i}>
                      <div className="vb-row">
                        <input
                          id={`vb-cn${i}`}
                          className={err('names') || err('coords') ? 'bad lg-name' : 'lg-name'}
                          value={c.name}
                          spellCheck={false}
                          aria-label={`Координата ${i + 1}`}
                          onChange={(e) => store.type(`cn${i}`, (p) => (p.energy.coords[i].name = e.target.value))}
                          onBlur={end(`cn${i}`)}
                        />
                        <SymField
                          id={`vb-H${i}`}
                          label=""
                          wide={false}
                          placeholder={forceOn ? 'амплитуда силы H' : 'сила H (если есть)'}
                          value={c.H}
                          ctx={ctx}
                          err={err('H' + i)}
                          onType={(v) => store.type(`cH${i}`, (p) => (p.energy.coords[i].H = v))}
                          onEnd={end(`cH${i}`)}
                        />
                        <button
                          type="button"
                          className="del"
                          aria-label={`Убрать координату ${c.name}`}
                          disabled={E.coords.length <= 1}
                          onClick={() => store.removeCoord(i)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="cgpar cg0">
                        {N(`ceq${i}`, 'q*', c.eq, (p, v) => (p.energy.coords[i].eq = v))}
                        {N(`cq0${i}`, 'q(0)', c.q0, (p, v) => (p.energy.coords[i].q0 = v))}
                        {N(`cv0${i}`, 'q̇(0)', c.v0, (p, v) => (p.energy.coords[i].v0 = v))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="vbaddq" disabled={E.coords.length >= MAX_DOF} onClick={store.addCoord}>
                    + координата
                  </button>
                </div>
                <div className="sub">Энергия</div>
                <div className="sgrid">
                  <SymField
                    id="vb-T"
                    label="T(q, q̇)"
                    value={E.T}
                    ctx={ctx}
                    err={err('T')}
                    onType={(v) => store.type('T', (p) => (p.energy.T = v))}
                    onEnd={end('T')}
                  />
                  <SymField
                    id="vb-P"
                    label="Π(q)"
                    value={E.P}
                    ctx={ctx}
                    err={err('P') ?? err('eq')}
                    onType={(v) => store.type('P', (p) => (p.energy.P = v))}
                    onEnd={end('P')}
                  />
                  <SymField
                    id="vb-D"
                    label="Φ(q̇) — сопротивление"
                    value={E.D}
                    ctx={ctx}
                    err={err('D')}
                    onType={(v) => store.type('D', (p) => (p.energy.D = v))}
                    onEnd={end('D')}
                  />
                </div>
                <div className="sub">Параметры</div>
                <div className="lg-table lg-params">
                  {E.params.map((q, i) => (
                    <div className="arow" key={i}>
                      <input
                        id={`vb-pn${i}`}
                        className={err('names') ? 'bad lg-name' : 'lg-name'}
                        value={q.name}
                        spellCheck={false}
                        aria-label={`Параметр ${i + 1}`}
                        onChange={(e) => store.type(`pn${i}`, (p) => (p.energy.params[i].name = e.target.value))}
                        onBlur={end(`pn${i}`)}
                      />
                      <span className="lg-eqs">=</span>
                      <Num
                        id={`vb-pv${i}`}
                        label=""
                        value={q.value}
                        neg
                        zero
                        onType={(v) => store.type(`pv${i}`, (p) => (p.energy.params[i].value = v))}
                        onEnd={end(`pv${i}`)}
                      />
                      <button type="button" className="del" aria-label={`Убрать параметр ${q.name}`} onClick={() => store.removeParam(i)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="vbaddp" onClick={store.addParam}>
                    + параметр
                  </button>
                </div>
                {(err('names') || err('coords')) && <p className="lg-err">{err('names') ?? err('coords')}</p>}
                <p className="empty">
                  Формулы — как в «Уравнениях Лагранжа»: скорость штрихом (x′, φ′), греческие буквы латиницей (phi, psi). Коэффициенты берутся в положении q*; T
                  и Π можно писать точными (cos φ), не раскладывая.
                </p>
              </>
            )}

            {pr.src === 'chain' && (
              <>
                <div className="sgrid">
                  <label className="field">
                    <span>Тела</span>
                    <select id="vbkind" value={C.kind} onChange={(e) => store.act((p) => (p.chain.kind = e.target.value as ChainSys['kind']))}>
                      {(Object.keys(KIND_T) as ChainSys['kind'][]).map((k) => (
                        <option key={k} value={k}>
                          {KIND_T[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Левый конец</span>
                    <select id="vbleft" value={C.left} onChange={(e) => store.act((p) => (p.chain.left = e.target.value as ChainSys['left']))}>
                      <option value="free">свободен</option>
                      <option value="fixed">закреплён</option>
                      <option value="moving">движется: ξ₀ sin pt</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Правый конец</span>
                    <select id="vbright" value={C.right} onChange={(e) => store.act((p) => (p.chain.right = e.target.value as ChainSys['right']))}>
                      <option value="free">свободен</option>
                      <option value="fixed">закреплён</option>
                    </select>
                  </label>
                </div>
                <div className="cgpar cg0">
                  {C.kind === 'shaft' && N('G', 'G (вал по d, l)', C.G, (p, v) => (p.chain.G = v), 'pos')}
                  {C.kind === 'string' && N('N', 'натяжение N', C.N, (p, v) => (p.chain.N = v), 'pos')}
                  {C.left === 'moving' && N('xi0', 'ξ₀', C.xi0, (p, v) => (p.chain.xi0 = v))}
                </div>
                <div className="sub">{C.kind === 'shaft' ? 'Диски' : 'Грузы'} и звенья (слева направо)</div>
                <div id="vbbodies">
                  {C.links.map((l, i) => {
                    const used = i === 0 ? C.left !== 'free' : i === C.bodies.length ? C.right === 'fixed' : true;
                    const who = i === 0 ? 'левый конец — 1' : i === C.bodies.length ? `${i} — правый конец` : `${i} — ${i + 1}`;
                    const c = linkStiffness(C, l);
                    // Номер звена — по порядку используемых (как на схеме).
                    const k = (C.left !== 'free' ? 0 : -1) + i + 1;
                    return (
                      <div key={'l' + i}>
                        {used && (
                          <div className="vb-link">
                            <span className="vb-tag">
                              {C.kind === 'shaft' ? 'вал' : C.kind === 'string' ? 'нить' : 'пружина'} {who}
                            </span>
                            <div className="cgpar cg0">
                              {C.kind === 'string' ? (
                                N(`ll${i}`, `l${sb(k)}`, l.len, (p, v) => (p.chain.links[i].len = v), 'pos')
                              ) : C.kind === 'shaft' ? (
                                <>
                                  {N(`ld${i}`, `d${sb(k)} (0 — c)`, l.d, (p, v) => (p.chain.links[i].d = v), 'nonneg')}
                                  {l.d > 0
                                    ? N(`ll${i}`, `l${sb(k)}`, l.len, (p, v) => (p.chain.links[i].len = v), 'pos')
                                    : N(`lc${i}`, `c${sb(k)}`, l.c, (p, v) => (p.chain.links[i].c = v), 'nonneg')}
                                </>
                              ) : (
                                N(`lc${i}`, `c${sb(k)}`, l.c, (p, v) => (p.chain.links[i].c = v), 'nonneg')
                              )}
                              {C.kind !== 'string' && N(`lb${i}`, `b${sb(k)} демпф.`, l.b, (p, v) => (p.chain.links[i].b = v), 'nonneg')}
                              {C.kind !== 'spring' || l.d > 0 ? <span className="vb-c">c = {Number.isFinite(c) ? +c.toPrecision(5) : '—'}</span> : null}
                            </div>
                          </div>
                        )}
                        {i < C.bodies.length && (
                          <div className="vb-item">
                            <div className="vb-row">
                              <span className="vb-tag vb-body">
                                {C.kind === 'shaft' ? 'диск' : 'груз'} {i + 1}
                              </span>
                              <button
                                type="button"
                                className="del"
                                aria-label={`Убрать тело ${i + 1}`}
                                disabled={C.bodies.length <= 1}
                                onClick={() => store.removeBody(i)}
                              >
                                ×
                              </button>
                            </div>
                            <div className="cgpar cg0">
                              {N(`bm${i}`, `${m}${sb(i + 1)}`, C.bodies[i].m, (p, v) => (p.chain.bodies[i].m = v), 'pos')}
                              {N(`bg${i}`, 'c к опоре', C.bodies[i].cg, (p, v) => (p.chain.bodies[i].cg = v), 'nonneg')}
                              {N(`bq${i}`, 'q(0)', C.bodies[i].q0, (p, v) => (p.chain.bodies[i].q0 = v))}
                              {N(`bv${i}`, 'q̇(0)', C.bodies[i].v0, (p, v) => (p.chain.bodies[i].v0 = v))}
                              {N(`bH${i}`, 'сила H', C.bodies[i].H, (p, v) => (p.chain.bodies[i].H = v))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="segbtns">
                  <button type="button" id="vbaddb" disabled={C.bodies.length >= MAX_DOF} onClick={store.addBody}>
                    + {C.kind === 'shaft' ? 'диск' : 'груз'}
                  </button>
                </div>
                {err('chain') && <p className="lg-err">{err('chain')}</p>}
                <p className="empty">
                  Диск на валу: m — момент инерции J, c — крутильная жёсткость участка (или по d и l: c = GπD⁴/(32l)). Нить: c = N/l. «c к опоре» — пружина от
                  тела к неподвижной точке.
                </p>
              </>
            )}

            {pr.src === 'beam' && (
              <>
                <div className="cgpar cg0">
                  {N('L', 'длина L', B.L, (p, v) => (p.beam.L = v), 'pos')}
                  {N('EJ', 'жёсткость EJ', B.EJ, (p, v) => (p.beam.EJ = v), 'pos')}
                </div>
                <div className="sub">Опоры</div>
                <div id="vbsupports">
                  {B.supports.map((s, i) => (
                    <div className="vb-row vb-sup" key={i}>
                      <select
                        id={`vb-sk${i}`}
                        value={s.kind}
                        aria-label={`Опора ${i + 1}`}
                        onChange={(e) => store.act((p) => (p.beam.supports[i].kind = e.target.value as 'pin' | 'fixed'))}
                      >
                        <option value="pin">шарнир</option>
                        <option value="fixed">заделка</option>
                      </select>
                      {N(`sx${i}`, 'x', s.x, (p, v) => (p.beam.supports[i].x = v), 'nonneg')}
                      <button type="button" className="del" aria-label={`Убрать опору ${i + 1}`} onClick={() => store.removeSupport(i)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="vbadds" onClick={store.addSupport}>
                    + опора
                  </button>
                </div>
                <div className="sub">Грузы</div>
                <div id="vbmasses">
                  {B.masses.map((ms, i) => (
                    <div className="vb-item" key={i}>
                      <div className="vb-row">
                        <span className="vb-tag vb-body">груз {i + 1}</span>
                        <button
                          type="button"
                          className="del"
                          aria-label={`Убрать груз ${i + 1}`}
                          disabled={B.masses.length <= 1}
                          onClick={() => store.removeMass(i)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="cgpar cg0">
                        {N(`mx${i}`, 'x', ms.x, (p, v) => (p.beam.masses[i].x = v), 'nonneg')}
                        {N(`mm${i}`, 'm', ms.m, (p, v) => (p.beam.masses[i].m = v), 'pos')}
                        {N(`mJ${i}`, 'J (поворот)', ms.J, (p, v) => (p.beam.masses[i].J = v), 'nonneg')}
                        {N(`me${i}`, 'e (центр масс)', ms.e, (p, v) => (p.beam.masses[i].e = v))}
                        {N(`mH${i}`, 'сила H', ms.H, (p, v) => (p.beam.masses[i].H = v))}
                        {N(`mh${i}`, 'стойка h', ms.h ?? 0, (p, v) => (p.beam.masses[i].h = v), 'nonneg')}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="vbaddm" disabled={B.masses.length >= MAX_DOF} onClick={store.addMass}>
                    + груз
                  </button>
                </div>
                {err('beam') && <p className="lg-err">{err('beam')}</p>}
                <p className="empty">
                  Балка невесома, EJ постоянна; опоры — шарниры и заделки (можно статически неопределимо). Груз с моментом инерции J или со смещённым на e
                  центром масс даёт вторую координату — поворот. Груз на вершине стойки высотой h (жёстко связана с балкой, та же EJ) — координаты x (вбок) и y.
                </p>
              </>
            )}

            {pr.src === 'absorber' && (
              <>
                <div className="cgpar cg0">
                  {N('m1', 'масса m₁', A.m1, (p, v) => (p.absorber.m1 = v), 'pos')}
                  {!A.c1Res && N('c1', 'жёсткость c₁', A.c1, (p, v) => (p.absorber.c1 = v), 'pos')}
                  {N('aH', 'сила H', A.H, (p, v) => (p.absorber.H = v))}
                </div>
                <label className="toggle">
                  <input type="checkbox" id="vbres" checked={A.c1Res} onChange={(e) => store.act((p) => (p.absorber.c1Res = e.target.checked))} />
                  основная система в резонансе: c₁ = m₁p²
                </label>
                <label className="field">
                  <span>Гаситель задан</span>
                  <select id="vbby" value={A.by} onChange={(e) => store.act((p) => (p.absorber.by = e.target.value as 'amp' | 'mass'))}>
                    <option value="amp">наибольшей амплитудой A</option>
                    <option value="mass">массой m₂</option>
                  </select>
                </label>
                <div className="cgpar cg0">
                  {A.by === 'amp'
                    ? N('aA', 'амплитуда A', A.A, (p, v) => (p.absorber.A = v), 'pos')
                    : N('am2', 'масса m₂', A.m2, (p, v) => (p.absorber.m2 = v), 'pos')}
                </div>
                {err('absorber') && <p className="lg-err">{err('absorber')}</p>}
              </>
            )}

            <div className="sub">Возмущение и графики</div>
            <div className="sgrid">
              {pr.src !== 'absorber' && (
                <label className="field">
                  <span>Сила H</span>
                  <select
                    id="vbforce"
                    value={pr.force.kind === 'harm' && pr.force.cos ? 'harmcos' : pr.force.kind}
                    onChange={(e) =>
                      store.act((p) => {
                        const v = e.target.value;
                        p.force.kind = (v === 'harmcos' ? 'harm' : v) as ForceKind;
                        p.force.cos = v === 'harmcos';
                      })
                    }
                  >
                    <option value="none">нет (свободные колебания)</option>
                    <option value="harm">гармоническая H sin pt</option>
                    <option value="harmcos">гармоническая H cos pt</option>
                    <option value="const">постоянная, с момента t = 0</option>
                  </select>
                </label>
              )}
              {(pr.force.kind === 'harm' || pr.src === 'absorber') && (
                <Num id="vb-p" label="частота p" unit="рад/с" value={pr.force.p} onType={(v) => store.type('p', (p) => (p.force.p = v))} onEnd={end('p')} />
              )}
              {forceOn && pr.src !== 'absorber' && (
                <Num
                  id="vb-dst"
                  label="статическое смещение δ"
                  value={pr.force.dst ?? 0}
                  neg
                  onType={(v) => store.type('dst', (p) => (p.force.dst = v))}
                  onEnd={end('dst')}
                />
              )}
              <Num
                id="vb-tend"
                label="время графиков"
                unit="с"
                value={pr.tEnd}
                zero
                onType={(v) => store.type('tEnd', (p) => (p.tEnd = v))}
                onEnd={end('tEnd')}
              />
            </div>
            {err('force') && <p className="lg-err">{err('force')}</p>}
            {forceOn && pr.src !== 'absorber' && (
              <p className="empty">
                δ ≠ 0 — амплитуда по статическому смещению (Яблонский, Д.26): H — сила единичной амплитуды, δ — смещение точки приложения по линии силы (поворот
                тела под моментом) от постоянной силы той же величины; 0 — H задана как есть.
              </p>
            )}
            <p className="empty">Единицы — любые согласованные (СИ или кГ, см, с, как в задачнике). Время 0 — без графика движения.</p>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="vbsolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Колебания систем · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} role="img" aria-label="Схема и формы колебаний" dangerouslySetInnerHTML={{ __html: fig.svg }} />
            <figcaption>Схема, формы главных колебаний, графики</figcaption>
          </figure>
        </section>
        <section className="pr-sec">
          <h2>Решение</h2>
          <DocView doc={doc} />
        </section>
      </article>
    </>
  );
}
