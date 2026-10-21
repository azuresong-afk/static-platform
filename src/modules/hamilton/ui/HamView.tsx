/**
 * Экран «Устойчивость и нелинейные колебания»: интегралы движения, функции Рауса и Гамильтона (§49) со стационарными
 * движениями (§55); устойчивость по первому приближению (§55); нелинейные колебания (§56); равновесие и устойчивость
 * в общем виде (§52, 55); катящийся диск (55.12–55.14); уравнение Якоби — Гамильтона, струна и нить (49.15–49.22).
 */
import { useMemo, useState, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import type { Doc } from '../../../shared/doc';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';
import { normName, parseSym, prettyName, varName, type SymContext } from '../../../shared/sym';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import type { LagParam } from '../../lagrange/model/lagrange';
import { lettersPlots, nonlinPlots, rollPlots, routhPlots, stabPlots, stringPlots } from '../draw/plots';
import { solveHJ, solveString } from '../model/jacobi';
import { solveLetters } from '../model/letters';
import { solveNonlin } from '../model/nonlin';
import { solveRoll } from '../model/roll';
import { solveRouth } from '../model/routh';
import { solveStability, type StabForm } from '../model/stability';
import { HAM_PRESETS, type HamMode, type HamPresetKey } from '../presets';
import { hjDoc, lettersDoc, rollDoc, stringDoc } from '../text/general';
import { nonlinDoc, routhDoc, stabDoc } from '../text/solution';
import type { HamStore } from './store';

const MODES: [HamMode, string][] = [
  ['routh', 'Интегралы, Раус, Гамильтон'],
  ['stab', 'Устойчивость'],
  ['nonlin', 'Нелинейные колебания'],
  ['letters', 'В общем виде'],
  ['roll', 'Катящийся диск'],
  ['jacobi', 'Якоби — Гамильтон, струна'],
];
const FORMS: [StabForm, string][] = [
  ['poly', 'уравнение'],
  ['first', 'ẋ = A·x'],
  ['second', 'Mq̈ + Bq̇ + Cq = 0'],
];
const LEDE: Record<HamMode, string> = {
  routh:
    'По T и Π — обобщённые импульсы, циклические интегралы и интеграл энергии, функция Рауса и уравнения для остальных координат, функция Гамильтона и канонические уравнения, стационарные движения и их устойчивость (Мещерский, §49, 55).',
  stab: 'Характеристическое уравнение возмущённого движения — по коэффициентам, по матрице системы или по уравнениям второго порядка; условия Гурвица в буквах, корни, вывод и граница устойчивости по параметру (Мещерский, §55).',
  nonlin:
    'ẍ = f(x, ẋ): особые точки и фазовый портрет, метод усреднения — предельные циклы (автоколебания) и частота в зависимости от амплитуды, период по амплитуде (Мещерский, §56).',
  letters:
    'Равновесие и устойчивость в буквах: положение q* — формулами от параметров, условия Сильвестра или Гурвица, решённые относительно параметра; обратные задачи — момент, вес, безразличное равновесие; частоты и закон малых колебаний, канонические уравнения (Мещерский, §52, 55, 49.12; Яблонский, Д.23).',
  roll: 'Диск, обруч, колесо катятся без скольжения — неголономная связь: качение по прямой или вращение вокруг вертикального диаметра, условие устойчивости в буквах, корни, возмущённое движение (Мещерский, 55.12–55.14).',
  jacobi:
    'Уравнение Якоби — Гамильтона, разделение переменных, полный интеграл и первые интегралы; принцип Гамильтона — Остроградского для струны и тяжёлой нити — уравнение, граничные условия, собственные частоты и формы (Мещерский, 49.15–49.22).',
};
const SCAN_HINT = 'найти границу устойчивости перебором';

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
}: {
  id: string;
  label: string;
  value: string;
  ctx: SymContext;
  onType: (s: string) => void;
  onEnd: () => void;
  err?: string;
  wide?: boolean;
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
          placeholder={wide ? 'пусто — 0' : '0'}
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

function Params({ params, store, err }: { params: LagParam[]; store: HamStore; err?: string }) {
  return (
    <>
      <div className="sub">Параметры</div>
      <div className="lg-table lg-params">
        {params.map((p, i) => (
          <div className="arow" key={i}>
            <input
              id={`hm-pn${i}`}
              className={err ? 'bad lg-name' : 'lg-name'}
              value={p.name}
              spellCheck={false}
              aria-label={`Параметр ${i + 1}`}
              onChange={(e) => store.typeParam(i, 'name', e.target.value)}
              onBlur={() => store.endSession(`param:${i}:name`)}
            />
            <span className="lg-eqs">=</span>
            <Num
              id={`hm-pv${i}`}
              label=""
              value={p.value}
              neg
              zero
              onType={(v) => store.typeParam(i, 'value', v)}
              onEnd={() => store.endSession(`param:${i}:value`)}
            />
            <button type="button" className="del" aria-label={`Убрать параметр ${p.name}`} onClick={() => store.removeParam(i)}>
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="segbtns">
        <button type="button" id="hmaddp" onClick={store.addParam}>
          + параметр
        </button>
      </div>
      {err && <p className="lg-err">{err}</p>}
    </>
  );
}

export function HamView({ chrome, store }: { chrome: Chrome; store: HamStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const mode = pr.mode;
  const J = pr.jacobi;
  const res = useMemo(() => {
    switch (mode) {
      case 'routh':
        return { k: 'routh' as const, r: solveRouth(pr.routh) };
      case 'stab':
        return { k: 'stab' as const, r: solveStability(pr.stab) };
      case 'nonlin':
        return { k: 'nonlin' as const, r: solveNonlin(pr.nonlin) };
      case 'letters':
        return { k: 'letters' as const, r: solveLetters(pr.letters) };
      case 'roll':
        return { k: 'roll' as const, r: solveRoll(pr.roll) };
      case 'jacobi':
        return J.form === 'hj' ? { k: 'hj' as const, r: solveHJ(J.hj) } : { k: 'string' as const, r: solveString(J.str) };
    }
  }, [mode, pr.routh, pr.stab, pr.nonlin, pr.letters, pr.roll, J]);
  const doc = useMemo((): Doc | null => {
    const o = { explain: st.explain };
    if (!res.r.ok) return null;
    if (res.k === 'routh' && res.r.ok) return routhDoc(pr.routh, res.r, o);
    if (res.k === 'stab' && res.r.ok) return stabDoc(pr.stab, res.r, o);
    if (res.k === 'nonlin' && res.r.ok) return nonlinDoc(pr.nonlin, res.r, o);
    if (res.k === 'letters' && res.r.ok) return lettersDoc(pr.letters, res.r, o);
    if (res.k === 'roll' && res.r.ok) return rollDoc(pr.roll, res.r, o);
    if (res.k === 'hj' && res.r.ok) return hjDoc(J.hj, res.r, o);
    if (res.k === 'string' && res.r.ok) return stringDoc(J.str, res.r, o);
    return null;
  }, [res, pr.routh, pr.stab, pr.nonlin, pr.letters, pr.roll, J, st.explain]);
  const plots = useMemo(() => {
    if (!res.r.ok) return null;
    if (res.k === 'routh' && res.r.ok) return routhPlots(res.r);
    if (res.k === 'stab' && res.r.ok) return stabPlots(res.r);
    if (res.k === 'nonlin' && res.r.ok) return nonlinPlots(res.r);
    if (res.k === 'letters' && res.r.ok) return lettersPlots(res.r);
    if (res.k === 'roll' && res.r.ok) return rollPlots(res.r);
    if (res.k === 'hj' && res.r.ok) return routhPlots(res.r.routh);
    if (res.k === 'string' && res.r.ok) return stringPlots(res.r);
    return null;
  }, [res]);
  const err = (field: string) => (!res.r.ok && res.r.field === field ? res.r.error : undefined);
  const errPre = (pre: string) => (!res.r.ok && res.r.field.startsWith(pre) ? res.r.error : undefined);
  const note = st.preset !== 'custom' ? HAM_PRESETS[st.preset].note : null;
  const R = mode === 'jacobi' ? J.hj : pr.routh,
    S = pr.stab,
    N = pr.nonlin,
    L = pr.letters,
    O = pr.roll;
  const showRouth = mode === 'routh' || (mode === 'jacobi' && J.form === 'hj');
  const rctx: SymContext = { coords: R.coords.map((c) => normName(c.name.trim())), params: R.params.map((p) => normName(p.name.trim())) };
  const sctx: SymContext = { coords: [], params: S.params.map((p) => p.name.trim()) };
  const nctx: SymContext = { coords: [normName(N.name.trim())], params: N.params.map((p) => normName(p.name.trim())) };
  const lctx: SymContext = { coords: L.coords.map((c) => normName(c.name.trim())), params: L.params.map((p) => normName(p.name.trim())) };
  const lpctx: SymContext = { coords: [], params: lctx.params };
  const octx: SymContext = { coords: [], params: O.params.map((p) => normName(p.name.trim())) };
  const jctx: SymContext = { coords: ['x'], params: J.str.params.map((p) => normName(p.name.trim())) };
  const jpctx: SymContext = { coords: [], params: jctx.params };
  /** Выбор параметра и отрезок перебора (в общем виде и для диска). */
  const condPick = (id: string, label: string, params: string[], value: string, onPick: (v: string) => void, scan: { from: number; to: number } | null) => (
    <>
      <div className="sgrid">
        <label className="field">
          <span>{label}</span>
          <select id={id} value={value} onChange={(e) => onPick(e.target.value)}>
            <option value="">—</option>
            {params.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>
      {value && (
        <label className="toggle">
          <input type="checkbox" id="hm-rscan" checked={!!scan} onChange={(e) => store.setRange(e.target.checked)} />
          {SCAN_HINT}
        </label>
      )}
      {value && scan && (
        <div className="sgrid">
          <Num id="hm-rfrom" label="от" value={scan.from} neg zero onType={(v) => store.typeRange('from', v)} onEnd={() => store.endSession('range:from')} />
          <Num id="hm-rto" label="до" value={scan.to} neg zero onType={(v) => store.typeRange('to', v)} onEnd={() => store.endSession('range:to')} />
        </div>
      )}
    </>
  );
  const dotted = (n: string, o: number) => varName(prettyName(normName(n.trim()) || 'q'), o);
  const order = S.form === 'poly' ? S.poly.length - 1 : S.form === 'first' ? S.A.length : S.M.length;
  const maxOrder = S.form === 'poly' ? 6 : S.form === 'first' ? 4 : 3;
  const grid = (key: 'A' | 'M' | 'B' | 'C', G: string[][]) => (
    <div className="hm-mat" style={{ display: 'grid', gridTemplateColumns: `24px repeat(${G.length}, minmax(0, 1fr))`, gap: '4px', alignItems: 'end' }}>
      {G.map((row, i) => [
        <span key={`l${i}`} className="lg-eqs">
          {i === 0 ? key : ''}
        </span>,
        ...row.map((v, j) => (
          <SymField
            key={`${i}-${j}`}
            id={`hm-${key}${i}${j}`}
            label=""
            wide={false}
            value={v}
            ctx={sctx}
            err={err(`${key}${i}_${j}`)}
            onType={(s) => store.typeCell(key, i, j, s)}
            onEnd={() => store.endSession(`s:${key}:${i}:${j}`)}
          />
        )),
      ])}
    </div>
  );
  const solErr = !res.r.ok ? res.r.error : '';

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Устойчивость и нелинейные колебания</h1>
            <p className="lede">{LEDE[mode]}</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="hmpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as HamPresetKey)}>
                <PresetOptions items={taskEntries(HAM_PRESETS)} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />

        <section className="sheet" aria-label="Графики">
          <div className="bar">
            <div className="seg" role="group" aria-label="Режим">
              {MODES.map(([k, t]) => (
                <button key={k} type="button" id={`hm-mode-${k}`} aria-pressed={mode === k} onClick={() => store.setMode(k)}>
                  {t}
                </button>
              ))}
            </div>
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
          {note && (
            <p className="hint" style={{ padding: '8px 14px 0', margin: 0 }}>
              {note}
            </p>
          )}
          {plots ? (
            <div className="canvas lg-canvas">
              <svg id="hmplot" viewBox={plots.viewBox} role="img" aria-label="Графики" dangerouslySetInnerHTML={{ __html: plots.svg }} />
            </div>
          ) : (
            <div className="dg-empty" role="status">
              <p>{solErr || 'Задайте время интегрирования, чтобы увидеть графики движения.'}</p>
            </div>
          )}
        </section>

        <div className="cols">
          <section className="panel conv" aria-label="Система">
            <h2>Система</h2>
            {mode === 'jacobi' && (
              <>
                <div className="sub">Задача</div>
                <div className="seg" role="group" aria-label="Задача">
                  <button type="button" id="hm-jform-hj" aria-pressed={J.form === 'hj'} onClick={() => store.setJacForm('hj')}>
                    Якоби — Гамильтон
                  </button>
                  <button type="button" id="hm-jform-string" aria-pressed={J.form === 'string'} onClick={() => store.setJacForm('string')}>
                    струна, нить
                  </button>
                </div>
              </>
            )}
            {showRouth && (
              <>
                <div className="sub">Обобщённые координаты</div>
                <div className="lg-table lg-coords">
                  <div className="ahead">
                    <span>q</span>
                    <span>
                      Q<sup>н</sup> (непотенц.)
                    </span>
                    <span>
                      q<sub>0</sub>
                    </span>
                    <span>
                      q̇<sub>0</sub>
                    </span>
                    <span>q* (стац.)</span>
                    <span />
                  </div>
                  {R.coords.map((c, i) => (
                    <div className="arow" key={i}>
                      <input
                        id={`hm-cn${i}`}
                        className={err('names') || err('coords') ? 'bad lg-name' : 'lg-name'}
                        value={c.name}
                        spellCheck={false}
                        aria-label={`Координата ${i + 1}`}
                        onChange={(e) => store.typeCoord(i, 'name', e.target.value)}
                        onBlur={() => store.endSession(`r:coord:${i}:name`)}
                      />
                      <SymField
                        id={`hm-q${i}`}
                        label=""
                        wide={false}
                        value={c.Q}
                        ctx={rctx}
                        err={err('Q' + i)}
                        onType={(v) => store.typeCoord(i, 'Q', v)}
                        onEnd={() => store.endSession(`r:coord:${i}:Q`)}
                      />
                      <Num
                        id={`hm-q0${i}`}
                        label=""
                        value={c.q0}
                        neg
                        zero
                        onType={(v) => store.typeCoord(i, 'q0', v)}
                        onEnd={() => store.endSession(`r:coord:${i}:q0`)}
                      />
                      <Num
                        id={`hm-v0${i}`}
                        label=""
                        value={c.v0}
                        neg
                        zero
                        onType={(v) => store.typeCoord(i, 'v0', v)}
                        onEnd={() => store.endSession(`r:coord:${i}:v0`)}
                      />
                      <Num
                        id={`hm-eq${i}`}
                        label=""
                        value={c.eq}
                        neg
                        zero
                        onType={(v) => store.typeCoord(i, 'eq', v)}
                        onEnd={() => store.endSession(`r:coord:${i}:eq`)}
                      />
                      <button
                        type="button"
                        className="del"
                        aria-label={`Убрать координату ${c.name}`}
                        disabled={R.coords.length <= 1}
                        onClick={() => store.removeCoord(i)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="hmaddq" disabled={R.coords.length >= 3} onClick={store.addCoord}>
                    + координата
                  </button>
                </div>
                <p className="empty">
                  Циклические координаты (не входят в T и Π, без непотенциальной силы) находятся сами. q* — приближение стационарного движения (положения
                  равновесия) для остальных координат; постоянные циклических интегралов берутся по начальным условиям.
                </p>
                <div className="sub">Энергия</div>
                <div className="sgrid">
                  <SymField
                    id="hm-T"
                    label={`T(q, ${R.coords.map((c) => dotted(c.name, 1)).join(', ')})`}
                    value={R.T}
                    ctx={rctx}
                    err={err('T')}
                    onType={(v) => store.typeRouthText('T', v)}
                    onEnd={() => store.endSession('r:T')}
                  />
                  <SymField
                    id="hm-P"
                    label="Π(q)"
                    value={R.P}
                    ctx={rctx}
                    err={err('P')}
                    onType={(v) => store.typeRouthText('P', v)}
                    onEnd={() => store.endSession('r:P')}
                  />
                </div>
                <Params params={R.params} store={store} err={err('names')} />
                <div className="sgrid">
                  <Num
                    id="hm-tend"
                    label="Время интегрирования"
                    unit="с"
                    value={R.tEnd}
                    zero
                    onType={store.typeRouthTime}
                    onEnd={() => store.endSession('r:tEnd')}
                  />
                </div>
                <p className="empty">Формулы: скорость — штрихом (x′, φ′), греческие буквы можно писать латиницей (phi, theta). Единицы — СИ.</p>
              </>
            )}
            {mode === 'jacobi' && J.form === 'string' && (
              <>
                <div className="sub">Струна (нить)</div>
                <div className="sgrid">
                  <SymField
                    id="hm-srho"
                    label="ρ(x) — линейная плотность"
                    value={J.str.rho}
                    ctx={jctx}
                    err={err('rho')}
                    onType={(v) => store.typeStr('rho', v)}
                    onEnd={() => store.endSession('j:rho')}
                  />
                  <SymField
                    id="hm-sT"
                    label="T(x) — натяжение"
                    value={J.str.T}
                    ctx={jctx}
                    err={err('Tstr')}
                    onType={(v) => store.typeStr('T', v)}
                    onEnd={() => store.endSession('j:T')}
                  />
                  <SymField
                    id="hm-sl"
                    label="l — длина"
                    wide={false}
                    value={J.str.l}
                    ctx={jpctx}
                    err={err('l')}
                    onType={(v) => store.typeStr('l', v)}
                    onEnd={() => store.endSession('j:l')}
                  />
                </div>
                <div className="sub">Конец x = l (x = 0 закреплён)</div>
                <div className="seg" role="group" aria-label="Конец x = l">
                  <button type="button" id="hm-bc-fixed" aria-pressed={J.str.bc === 'fixed'} onClick={() => store.setStrBC('fixed')}>
                    закреплён
                  </button>
                  <button type="button" id="hm-bc-free" aria-pressed={J.str.bc === 'free'} onClick={() => store.setStrBC('free')}>
                    свободен
                  </button>
                </div>
                <div className="sgrid">
                  <label className="field">
                    <span>Число форм</span>
                    <select id="hm-modes" value={J.str.modes} onChange={(e) => store.typeStr('modes', +e.target.value)}>
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <Params params={J.str.params} store={store} err={err('names')} />
                <p className="empty">x — координата вдоль струны (от закреплённого конца), y — поперечное отклонение. Тяжёлая нить: T = ρg(l − x).</p>
              </>
            )}
            {mode === 'letters' && (
              <>
                <div className="sub">Обобщённые координаты</div>
                <div className="lg-table lg-coords">
                  <div className="ahead">
                    <span>q</span>
                    <span>q* (положение)</span>
                    <span>
                      Q<sup>н</sup> (непотенц.)
                    </span>
                    <span>δq₀</span>
                    <span>δq̇₀</span>
                    <span />
                  </div>
                  {L.coords.map((c, i) => (
                    <div className="arow" key={i}>
                      <input
                        id={`hm-lcn${i}`}
                        className={err('names') || err('coords') ? 'bad lg-name' : 'lg-name'}
                        value={c.name}
                        spellCheck={false}
                        aria-label={`Координата ${i + 1}`}
                        onChange={(e) => store.typeLetCoord(i, 'name', e.target.value)}
                        onBlur={() => store.endSession(`l:coord:${i}:name`)}
                      />
                      <SymField
                        id={`hm-lat${i}`}
                        label=""
                        wide={false}
                        value={c.at}
                        ctx={lpctx}
                        err={err('at' + i)}
                        onType={(v) => store.typeLetCoord(i, 'at', v)}
                        onEnd={() => store.endSession(`l:coord:${i}:at`)}
                      />
                      <SymField
                        id={`hm-lq${i}`}
                        label=""
                        wide={false}
                        value={c.Q}
                        ctx={lctx}
                        err={err('Q' + i)}
                        onType={(v) => store.typeLetCoord(i, 'Q', v)}
                        onEnd={() => store.endSession(`l:coord:${i}:Q`)}
                      />
                      <Num
                        id={`hm-ldq${i}`}
                        label=""
                        value={c.dq0}
                        neg
                        zero
                        onType={(v) => store.typeLetCoord(i, 'dq0', v)}
                        onEnd={() => store.endSession(`l:coord:${i}:dq0`)}
                      />
                      <Num
                        id={`hm-ldv${i}`}
                        label=""
                        value={c.dv0}
                        neg
                        zero
                        onType={(v) => store.typeLetCoord(i, 'dv0', v)}
                        onEnd={() => store.endSession(`l:coord:${i}:dv0`)}
                      />
                      <button
                        type="button"
                        className="del"
                        aria-label={`Убрать координату ${c.name}`}
                        disabled={L.coords.length <= 1}
                        onClick={() => store.removeLetCoord(i)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="hmaddlq" disabled={L.coords.length >= 3} onClick={store.addLetCoord}>
                    + координата
                  </button>
                </div>
                <p className="empty">
                  q* — формула от параметров (arccos(g c/(ω^2 a^2)), π/2). Если q* не обращает силы в нуль, оно — начальное приближение: уравнения равновесия
                  выводятся в буквах, корень ищется численно.
                </p>
                <div className="sub">Энергия</div>
                <div className="sgrid">
                  <SymField
                    id="hm-lT"
                    label={`T(q, ${L.coords.map((c) => dotted(c.name, 1)).join(', ')}) — пусто, если только равновесие`}
                    value={L.T}
                    ctx={lctx}
                    err={err('T')}
                    onType={(v) => store.typeLetText('T', v)}
                    onEnd={() => store.endSession('l:T')}
                  />
                  <SymField
                    id="hm-lP"
                    label="Π(q)"
                    value={L.P}
                    ctx={lctx}
                    err={err('P')}
                    onType={(v) => store.typeLetText('P', v)}
                    onEnd={() => store.endSession('l:P')}
                  />
                </div>
                <Params params={L.params} store={store} err={err('names')} />
                <div className="sub">Обратная задача</div>
                <div className="sgrid">
                  <label className="field">
                    <span>Искомый параметр</span>
                    <select
                      id="hm-unk"
                      className={err('unknown') ? 'bad' : undefined}
                      value={L.unknown}
                      onChange={(e) => store.setLetChoice('unknown', e.target.value)}
                    >
                      <option value="">—</option>
                      {lctx.params.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {L.unknown && (
                  <label className="toggle">
                    <input type="checkbox" id="hm-indiff" checked={L.indifferent} onChange={(e) => store.setIndifferent(e.target.checked)} />
                    безразличное равновесие (в любом положении)
                  </label>
                )}
                {err('unknown') && <p className="lg-err">{err('unknown')}</p>}
                <div className="sub">Условия устойчивости</div>
                {condPick('hm-lcond', 'Решить относительно параметра', lctx.params, L.cond, (v) => store.setLetChoice('cond', v), L.scan)}
                {(err('cond') || err('params') || errPre('at')) && <p className="lg-err">{res.r.ok ? '' : res.r.error}</p>}
              </>
            )}
            {mode === 'roll' && (
              <>
                <div className="sub">Стационарное движение</div>
                <div className="seg" role="group" aria-label="Движение">
                  <button type="button" id="hm-motion-line" aria-pressed={O.motion === 'line'} onClick={() => store.setRollChoice('motion', 'line')}>
                    качение по прямой
                  </button>
                  <button type="button" id="hm-motion-spin" aria-pressed={O.motion === 'spin'} onClick={() => store.setRollChoice('motion', 'spin')}>
                    вращение вокруг диаметра
                  </button>
                </div>
                <div className="sgrid">
                  <SymField
                    id="hm-om"
                    label="m — масса"
                    wide={false}
                    value={O.m}
                    ctx={octx}
                    err={err('m')}
                    onType={(v) => store.typeRoll('m', v)}
                    onEnd={() => store.endSession('o:m')}
                  />
                  <SymField
                    id="hm-oa"
                    label="a — радиус"
                    wide={false}
                    value={O.a}
                    ctx={octx}
                    err={err('a')}
                    onType={(v) => store.typeRoll('a', v)}
                    onEnd={() => store.endSession('o:a')}
                  />
                  <SymField
                    id="hm-oA"
                    label="A — момент инерции относительно диаметра"
                    wide={false}
                    value={O.A}
                    ctx={octx}
                    err={err('A')}
                    onType={(v) => store.typeRoll('A', v)}
                    onEnd={() => store.endSession('o:A')}
                  />
                  <SymField
                    id="hm-oC"
                    label="C — относительно оси симметрии"
                    wide={false}
                    value={O.C}
                    ctx={octx}
                    err={err('C')}
                    onType={(v) => store.typeRoll('C', v)}
                    onEnd={() => store.endSession('o:C')}
                  />
                  <SymField
                    id="hm-ow"
                    label={O.motion === 'line' ? 'Ω — угловая скорость качения' : 'ω — вокруг вертикального диаметра'}
                    wide={false}
                    value={O.w}
                    ctx={octx}
                    err={err('w')}
                    onType={(v) => store.typeRoll('w', v)}
                    onEnd={() => store.endSession('o:w')}
                  />
                </div>
                <Params params={O.params} store={store} err={err('names')} />
                {condPick('hm-ocond', 'Условие относительно параметра', octx.params, O.cond, (v) => store.setRollChoice('cond', v), O.scan)}
                <div className="sub">Возмущённое движение</div>
                <div className="sgrid">
                  <Num
                    id="hm-oth0"
                    label="θ₀"
                    unit="рад"
                    value={O.th0}
                    neg
                    zero
                    onType={(v) => store.typeRoll('th0', v)}
                    onEnd={() => store.endSession('o:th0')}
                  />
                  <Num
                    id="hm-otend"
                    label="Время"
                    unit="с"
                    value={O.tEnd}
                    zero
                    onType={(v) => store.typeRoll('tEnd', v)}
                    onEnd={() => store.endSession('o:tEnd')}
                  />
                </div>
                {(err('cond') || err('params')) && <p className="lg-err">{res.r.ok ? '' : res.r.error}</p>}
                <p className="empty">Нужен параметр g. Обруч: A = ma²/2, C = ma²; однородный диск: A = ma²/4, C = ma²/2.</p>
              </>
            )}
            {mode === 'stab' && (
              <>
                <div className="sub">Как задана система</div>
                <div className="seg" role="group" aria-label="Форма">
                  {FORMS.map(([k, t]) => (
                    <button key={k} type="button" id={`hm-form-${k}`} aria-pressed={S.form === k} onClick={() => store.setForm(k)}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="sgrid">
                  <label className="field">
                    <span>{S.form === 'poly' ? 'Степень уравнения' : S.form === 'first' ? 'Порядок системы' : 'Число координат'}</span>
                    <select id="hm-order" value={order} onChange={(e) => store.setOrder(+e.target.value)}>
                      {Array.from({ length: maxOrder }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {S.form === 'poly' && (
                  <div className="sgrid">
                    {S.poly.map((v, i) => (
                      <SymField
                        key={i}
                        id={`hm-a${i}`}
                        label={`a${'₀₁₂₃₄₅₆'[i]} (при λ${S.poly.length - 1 - i > 1 ? '⁰¹²³⁴⁵⁶'[S.poly.length - 1 - i] : S.poly.length - 1 - i === 1 ? '' : '⁰'})`}
                        wide={false}
                        value={v}
                        ctx={sctx}
                        err={err('a' + i)}
                        onType={(s) => store.typePoly(i, s)}
                        onEnd={() => store.endSession(`s:poly:${i}`)}
                      />
                    ))}
                  </div>
                )}
                {S.form === 'first' && grid('A', S.A)}
                {S.form === 'second' && (
                  <>
                    {grid('M', S.M)}
                    {grid('B', S.B)}
                    {grid('C', S.C)}
                  </>
                )}
                {(errPre('A') || errPre('M') || errPre('B') || errPre('C') || err('poly') || err('params')) && (
                  <p className="lg-err">{res.r.ok ? '' : res.r.error}</p>
                )}
                <Params params={S.params} store={store} err={err('names')} />
                <label className="toggle">
                  <input type="checkbox" id="hmscan" checked={!!S.scan} onChange={(e) => store.setScan(e.target.checked)} />
                  найти границы устойчивости по параметру
                </label>
                {S.scan && (
                  <div className="sgrid">
                    <label className="field">
                      <span>Параметр</span>
                      <select id="hm-scanp" value={S.scan.param} onChange={(e) => store.typeScan('param', e.target.value)}>
                        {S.params.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Num
                      id="hm-scanfrom"
                      label="от"
                      value={S.scan.from}
                      neg
                      zero
                      onType={(v) => store.typeScan('from', v)}
                      onEnd={() => store.endSession('s:scan:from')}
                    />
                    <Num
                      id="hm-scanto"
                      label="до"
                      value={S.scan.to}
                      neg
                      zero
                      onType={(v) => store.typeScan('to', v)}
                      onEnd={() => store.endSession('s:scan:to')}
                    />
                  </div>
                )}
                <p className="empty">
                  Коэффициенты и элементы матриц — формулы от параметров; условия Гурвица выводятся в буквах, корни и вывод — при заданных числах.
                </p>
              </>
            )}
            {mode === 'nonlin' && (
              <>
                <div className="sub">Уравнение</div>
                <div className="sgrid">
                  <label className="sfield">
                    <span>Координата</span>
                    <span className="inp">
                      <input
                        id="hm-xn"
                        className={err('names') ? 'bad lg-name' : 'lg-name'}
                        value={N.name}
                        spellCheck={false}
                        onChange={(e) => store.typeNonlin('name', e.target.value)}
                        onBlur={() => store.endSession('n:name')}
                      />
                    </span>
                  </label>
                  <SymField
                    id="hm-f"
                    label={`${dotted(N.name, 2)} = f(${dotted(N.name, 0)}, ${dotted(N.name, 1)})`}
                    value={N.f}
                    ctx={nctx}
                    err={err('f')}
                    onType={(v) => store.typeNonlin('f', v)}
                    onEnd={() => store.endSession('n:f')}
                  />
                  <SymField
                    id="hm-k2"
                    label="k² — линейная часть (пусто — −∂f/∂x в нуле)"
                    value={N.k2}
                    ctx={{ coords: [], params: nctx.params }}
                    err={err('k2')}
                    onType={(v) => store.typeNonlin('k2', v)}
                    onEnd={() => store.endSession('n:k2')}
                  />
                </div>
                <div className="sgrid">
                  <Num
                    id="hm-x0"
                    label={`${dotted(N.name, 0)}₀`}
                    value={N.x0}
                    neg
                    zero
                    onType={(v) => store.typeNonlin('x0', v)}
                    onEnd={() => store.endSession('n:x0')}
                  />
                  <Num
                    id="hm-xv0"
                    label={`${dotted(N.name, 1)}₀`}
                    value={N.v0}
                    neg
                    zero
                    onType={(v) => store.typeNonlin('v0', v)}
                    onEnd={() => store.endSession('n:v0')}
                  />
                  <Num
                    id="hm-ntend"
                    label="Время"
                    unit="с"
                    value={N.tEnd}
                    onType={(v) => store.typeNonlin('tEnd', v)}
                    onEnd={() => store.endSession('n:tEnd')}
                  />
                  <Num id="hm-amax" label="Амплитуды до" value={N.aMax} onType={(v) => store.typeNonlin('aMax', v)} onEnd={() => store.endSession('n:aMax')} />
                </div>
                <div className="sub">Ещё траектории (начальное отклонение, без скорости)</div>
                <div className="sgrid">
                  {N.starts.map((x, i) => (
                    <div key={i} style={{ display: 'flex', gap: '4px', alignItems: 'end' }}>
                      <Num
                        id={`hm-st${i}`}
                        label={`${dotted(N.name, 0)}₀`}
                        value={x}
                        neg
                        zero
                        onType={(v) => store.typeStart(i, v)}
                        onEnd={() => store.endSession(`n:start:${i}`)}
                      />
                      <button type="button" className="del" aria-label="Убрать траекторию" onClick={() => store.removeStart(i)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="hmaddst" disabled={N.starts.length >= 6} onClick={store.addStart}>
                    + траектория
                  </button>
                </div>
                <Params params={N.params} store={store} err={err('names')} />
                <p className="empty">
                  Скорость — штрихом (x′); sign x записывается как x/abs(x). Метод усреднения применим, когда нелинейная часть Φ = f + k²x мала.
                </p>
              </>
            )}
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="hmsolution">{doc ? <DocView doc={doc} /> : <p className="empty">{solErr}</p>}</div>
          </section>
        </div>
      </div>
      {doc && (
        <article className="print-report" aria-hidden="true">
          <header className="pr-head">
            <h1>{st.title}</h1>
            <p>Устойчивость и нелинейные колебания · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </header>
          {plots && (
            <section className="pr-sec pr-figs">
              <figure>
                <svg viewBox={plots.viewBox} role="img" aria-label="Графики" dangerouslySetInnerHTML={{ __html: plots.svg }} />
              </figure>
            </section>
          )}
          <section className="pr-sec">
            <h2>Решение</h2>
            <DocView doc={doc} />
          </section>
        </article>
      )}
    </>
  );
}
