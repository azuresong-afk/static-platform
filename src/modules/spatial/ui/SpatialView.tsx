/**
 * Экран «Пространственное движение»: сложение вращений вокруг пересекающихся осей, углы Эйлера, дифференциал,
 * кинематический винт, гироскоп; чертёж и решение по шагам.
 */
import { useMemo, useState, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { parseSym } from '../../../shared/sym';
import { taskEntries } from '../../../shared/tasks';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import type { V3 } from '../../converging/model/forces';
import { renderSpatial } from '../draw/spatial';
import type { SPoint } from '../model/compose';
import type { GyroProblem } from '../model/gyro';
import { solveSpatial } from '../model/spatial';
import { SP_PRESETS, type SpMode, type SpPresetKey, type SpState } from '../presets';
import { spatialDoc } from '../text/solution';
import { MAX_POINTS, MAX_ROTS, type SpStore } from './store';

const MODE_T: Record<SpMode, string> = {
  compose: 'тело с неподвижной точкой: сложение вращений, качение конусов',
  euler: 'ориентация и угловая скорость по углам Эйлера',
  diff: 'дифференциальная (планетарная) коническая передача',
  screw: 'сложение мгновенных движений — кинематический винт',
  gyro: 'гироскоп: гироскопический момент, прецессия',
};
const SEQS: [string, string][] = [
  ['zxz', 'z–x–z — классические углы Эйлера'],
  ['zyz', 'z–y–z — углы Эйлера рисунка 20.3'],
  ['yzx', 'y–z–x — самолётные углы (20.5)'],
  ['yxz', 'y–x–z — корабельные углы (20.7), кардан (20.1)'],
  ['xyz', 'x–y–z — кардан (20.2)'],
  ['zyx', 'z–y–x — рыскание, тангаж, крен (оси z вверх)'],
  ['xyx', 'x–y–x'],
  ['xzx', 'x–z–x'],
  ['yxy', 'y–x–y'],
  ['yzy', 'y–z–y'],
  ['xzy', 'x–z–y'],
  ['zxy', 'z–x–y'],
];

/** Поле закона угла от t (символьный разбор). */
function LawSym({ id, label, value, onType, onEnd }: { id: string; label: string; value: string; onType: (s: string) => void; onEnd: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? value;
  const r = parseSym(shown.trim() || '0', { coords: [], params: [] });
  return (
    <label className="sfield">
      <span>{label}</span>
      <span className="inp">
        <input
          id={id}
          type="text"
          spellCheck={false}
          className={r.ok ? undefined : 'bad'}
          title={r.ok ? undefined : r.error}
          value={shown}
          onChange={(e) => {
            setText(e.target.value);
            if (parseSym(e.target.value.trim() || '0', { coords: [], params: [] }).ok) onType(e.target.value);
          }}
          onBlur={() => {
            setText(null);
            onEnd();
          }}
        />
      </span>
    </label>
  );
}

export function SpatialView({ chrome, store }: { chrome: Chrome; store: SpStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const s = st.problem;
  const out = useMemo(() => solveSpatial(s), [s]);
  const fig = useMemo(() => renderSpatial(s, out), [s, out]);
  const doc = useMemo(() => spatialDoc(s, out, { explain: st.explain }), [s, out, st.explain]);
  const note = st.preset !== 'custom' ? SP_PRESETS[st.preset].note : null;
  const end = (k: string) => () => store.endSession(k);
  const N = (key: string, label: string, value: number, set: (p: SpState, v: number) => void, kind: 'any' | 'pos' | 'nonneg' = 'any', unit?: string) => (
    <Num
      key={key}
      id={`sp-${key}`}
      label={label}
      unit={unit}
      value={value}
      neg={kind === 'any'}
      zero={kind !== 'pos'}
      onType={(v) => store.type(key, (p) => set(p, v))}
      onEnd={end(key)}
    />
  );
  const sel = <T extends string>(id: string, label: string, value: T, opts: [T, string][], set: (p: SpState, v: T) => void) => (
    <label className="field">
      <span>{label}</span>
      <select id={id} value={value} onChange={(e) => store.act((p) => set(p, e.target.value as T))}>
        {opts.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
  /** Таблица точек (имя и координаты). */
  const pointsTable = (prefix: string, pts: SPoint[], get: (p: SpState) => SPoint[], addId: string) => (
    <>
      <div id={`${prefix}points`}>
        {pts.map((q, i) => (
          <div className="sp-row" key={i}>
            <input
              id={`sp-${prefix}pn${i}`}
              className="lg-name"
              value={q.name}
              spellCheck={false}
              aria-label={`Точка ${i + 1}`}
              onChange={(e) => store.type(`${prefix}pn${i}`, (p) => (get(p)[i].name = e.target.value.slice(0, 12)))}
              onBlur={end(`${prefix}pn${i}`)}
            />
            {N(`${prefix}px${i}`, 'x', q.x, (p, v) => (get(p)[i].x = v))}
            {N(`${prefix}py${i}`, 'y', q.y, (p, v) => (get(p)[i].y = v))}
            {N(`${prefix}pz${i}`, 'z', q.z, (p, v) => (get(p)[i].z = v))}
            <button type="button" className="del" aria-label={`Убрать точку ${q.name}`} onClick={() => store.act((p) => get(p).splice(i, 1))}>
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="segbtns">
        <button
          type="button"
          id={addId}
          disabled={pts.length >= MAX_POINTS}
          onClick={() => store.act((p) => get(p).push({ name: String.fromCharCode(65 + get(p).length), x: 0, y: 1, z: 1 }))}
        >
          + точка
        </button>
      </div>
    </>
  );
  const v3 = (key: string, label: string, v: V3, set: (p: SpState, i: number, x: number) => void) => (
    <div className="cgpar cg0" key={key}>
      {[0, 1, 2].map((i) => N(`${key}${i}`, `${label}${'xyz'[i]}`, v[i], (p, x) => set(p, i, x)))}
    </div>
  );

  const C = s.compose,
    E = s.euler,
    D = s.diff,
    S = s.screw,
    G = s.gyro;
  const gy =
    <K extends keyof GyroProblem>(k: K) =>
    (p: SpState, v: GyroProblem[K]) =>
      (p.gyro[k] = v);

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Пространственное движение тела</h1>
            <p className="lede">
              Тело с неподвижной точкой: сложение вращений вокруг пересекающихся осей, качение конусов, углы Эйлера, дифференциальные передачи, кинематический
              винт, приближённая теория гироскопов (Мещерский, §19, 20, 25, 40).
            </p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="sppreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as SpPresetKey)}>
                <PresetOptions items={taskEntries(SP_PRESETS)} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />

        <section className="sheet" aria-label="Чертёж">
          <div className="bar">
            <span className="hint">{note ?? 'Оси: x — к нам, y — вправо, z — вверх. Векторы угловых скоростей — по правилу правого винта.'}</span>
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
            <svg id="spsvg" className="sketch" viewBox={fig.viewBox} role="img" aria-label="Чертёж" dangerouslySetInnerHTML={{ __html: fig.svg }} />
          </div>
        </section>

        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Задача</h2>
            {sel<SpMode>('spmode', 'Что решаем', s.mode, Object.entries(MODE_T) as [SpMode, string][], (p, v) => (p.mode = v))}

            {s.mode === 'compose' && (
              <>
                <div className="sgrid">
                  {sel(
                    'spunit',
                    'Угловые скорости',
                    C.unit,
                    [
                      ['rad', 'рад/с'],
                      ['rpm', 'об/мин'],
                    ],
                    (p, v) => (p.compose.unit = v),
                  )}
                  {sel(
                    'spscale',
                    'Переносное вращение (вокруг Oz)',
                    C.scale,
                    [['we', 'задана ωₑ'], ['period', 'период оборота T'], ...(C.rel === 'roll' ? ([['point', 'скорость точки']] as ['point', string][]) : [])],
                    (p, v) => (p.compose.scale = v),
                  )}
                </div>
                <div className="cgpar cg0">
                  {C.scale === 'we' && N('we', 'ωₑ', C.we, (p, v) => (p.compose.we = v))}
                  {C.scale === 'period' && N('T', 'T, с', C.T, (p, v) => (p.compose.T = v), 'pos')}
                  {C.scale === 'point' && (
                    <>
                      {N('pi', '№ точки', C.pi + 1, (p, v) => (p.compose.pi = Math.max(0, Math.round(v) - 1)), 'pos')}
                      {N('vp', 'её скорость', C.vp, (p, v) => (p.compose.vp = v), 'pos')}
                    </>
                  )}
                  {N('ee', 'εₑ, с⁻²', C.ee, (p, v) => (p.compose.ee = v))}
                  {N('alpha', 'α оси тела, °', C.alpha, (p, v) => (p.compose.alpha = v))}
                </div>
                {sel(
                  'sprel',
                  'Относительное вращение (вокруг оси тела)',
                  C.rel,
                  [
                    ['given', 'задана ωᵣ'],
                    ['roll', 'качение: ω — по линии касания'],
                  ],
                  (p, v) => {
                    p.compose.rel = v;
                    if (v === 'given' && p.compose.scale === 'point') p.compose.scale = 'we';
                  },
                )}
                <div className="cgpar cg0">
                  {C.rel === 'given' ? (
                    <>
                      {N('wr', 'ωᵣ', C.wr, (p, v) => (p.compose.wr = v))}
                      {N('er', 'εᵣ, с⁻²', C.er, (p, v) => (p.compose.er = v))}
                    </>
                  ) : (
                    N('gamma', 'γ линии касания, °', C.gamma, (p, v) => (p.compose.gamma = v))
                  )}
                </div>
                <div className="sub">Точки тела (координаты в данный момент)</div>
                {pointsTable('c', C.points, (p) => p.compose.points, 'spaddpt')}
                <p className="empty">
                  Ось тела и линия касания лежат в плоскости Oyz; углы α и γ отсчитываются от Oz к +y. Знак ω — вдоль орта оси (правый винт).
                </p>
              </>
            )}

            {s.mode === 'euler' && (
              <>
                {sel(
                  'spseq',
                  'Последовательность поворотов',
                  E.seq,
                  SEQS.some(([v]) => v === E.seq) ? SEQS : [[E.seq, E.seq], ...SEQS],
                  (p, v) => (p.euler.seq = v),
                )}
                <div className="sgrid">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="sp-law">
                      <input
                        id={`sp-en${i}`}
                        className="lg-name"
                        value={E.names[i]}
                        spellCheck={false}
                        aria-label={`Угол ${i + 1}`}
                        onChange={(e) => store.type(`en${i}`, (p) => (p.euler.names[i] = e.target.value.slice(0, 12)))}
                        onBlur={end(`en${i}`)}
                      />
                      <LawSym
                        id={`sp-law${i}`}
                        label={`${E.names[i]}(t), рад`}
                        value={E.laws[i]}
                        onType={(v) => store.type(`law${i}`, (p) => (p.euler.laws[i] = v.slice(0, 200)))}
                        onEnd={end(`law${i}`)}
                      />
                    </div>
                  ))}
                </div>
                <div className="cgpar cg0">{N('t1', 't₁, с', E.t1, (p, v) => (p.euler.t1 = v))}</div>
                <div className="sub">Точка тела (в осях тела; нули — без точки)</div>
                {v3('ept', 'ρ', E.point, (p, i, x) => (p.euler.point[i] = x))}
                <p className="empty">
                  Законы — формулы от t: «π/2 − 2t», «0,5 + t», «π/3». Первый поворот — вокруг неподвижной оси, следующие — вокруг повёрнутых.
                </p>
              </>
            )}

            {s.mode === 'diff' && (
              <>
                <div className="cgpar cg0">
                  {N('R1', 'R₁', D.R1, (p, v) => (p.diff.R1 = v), 'pos')}
                  {N('r1', 'r₁', D.r1, (p, v) => (p.diff.r1 = v), 'pos')}
                  {N('R2', 'R₂', D.R2, (p, v) => (p.diff.R2 = v), 'pos')}
                  {N('r2', 'r₂', D.r2, (p, v) => (p.diff.r2 = v), 'pos')}
                </div>
                <div className="sgrid">
                  {sel(
                    'spsign',
                    'Центральные колёса',
                    D.sign,
                    [
                      ['opp', 'по разные стороны сателлита'],
                      ['same', 'по одну сторону'],
                    ],
                    (p, v) => (p.diff.sign = v),
                  )}
                  {sel(
                    'spunk',
                    'Найти',
                    D.unknown,
                    [
                      ['H', 'ω_H — водило'],
                      ['1', 'ω₁ — колесо 1'],
                      ['2', 'ω₂ — колесо 2'],
                    ],
                    (p, v) => (p.diff.unknown = v),
                  )}
                </div>
                <label className="toggle">
                  <input type="checkbox" id="spcar" checked={D.car.on} onChange={(e) => store.act((p) => (p.diff.car.on = e.target.checked))} />
                  колёса автомобиля на повороте (ω₁, ω₂ — по скорости)
                </label>
                <div className="cgpar cg0">
                  {D.car.on ? (
                    <>
                      {N('cv', 'v', D.car.v, (p, v) => (p.diff.car.v = v))}
                      {N('crho', 'ρ поворота', D.car.rho, (p, v) => (p.diff.car.rho = v), 'pos')}
                      {N('cl', 'колея l', D.car.l, (p, v) => (p.diff.car.l = v), 'pos')}
                      {N('cRw', 'R колеса', D.car.Rw, (p, v) => (p.diff.car.Rw = v), 'pos')}
                    </>
                  ) : (
                    <>
                      {D.unknown !== '1' && N('w1', 'ω₁', D.w1, (p, v) => (p.diff.w1 = v))}
                      {D.unknown !== '2' && N('w2', 'ω₂', D.w2, (p, v) => (p.diff.w2 = v))}
                      {D.unknown !== 'H' && N('wH', 'ω_H', D.wH, (p, v) => (p.diff.wH = v))}
                    </>
                  )}
                  {N('d', 'd центра сател.', D.d, (p, v) => (p.diff.d = v), 'nonneg')}
                </div>
                <p className="empty">
                  Угловые скорости — со знаком (одно направление вращения вокруг главной оси — плюс); неподвижное колесо — 0. R — радиусы центральных колёс, r —
                  венцов сателлита, которыми он с ними зацепляется.
                </p>
              </>
            )}

            {s.mode === 'screw' && (
              <>
                <div className="sub">Вращения (точка оси, направление, ω)</div>
                <div id="sprots">
                  {S.rots.map((q, i) => (
                    <div className="vb-item" key={i}>
                      <div className="sp-row sp-row2">
                        <input
                          id={`sp-rn${i}`}
                          className="lg-name"
                          value={q.name}
                          spellCheck={false}
                          aria-label={`Вращение ${i + 1}`}
                          onChange={(e) => store.type(`rn${i}`, (p) => (p.screw.rots[i].name = e.target.value.slice(0, 12)))}
                          onBlur={end(`rn${i}`)}
                        />
                        {N(`rw${i}`, 'ω', q.w, (p, v) => (p.screw.rots[i].w = v))}
                        <button
                          type="button"
                          className="del"
                          aria-label={`Убрать вращение ${q.name}`}
                          onClick={() => store.act((p) => p.screw.rots.splice(i, 1))}
                        >
                          ×
                        </button>
                      </div>
                      {v3(`rp${i}`, 'A', q.p, (p, k, x) => (p.screw.rots[i].p[k] = x))}
                      {v3(`rd${i}`, 'e', q.d, (p, k, x) => (p.screw.rots[i].d[k] = x))}
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button
                    type="button"
                    id="spaddrot"
                    disabled={S.rots.length >= MAX_ROTS}
                    onClick={() => store.act((p) => p.screw.rots.push({ name: `ω${p.screw.rots.length + 1}`, p: [0, 0, 0], d: [0, 0, 1], w: 1 }))}
                  >
                    + вращение
                  </button>
                  <button
                    type="button"
                    id="spaddtr"
                    disabled={S.trans.length >= MAX_ROTS}
                    onClick={() => store.act((p) => p.screw.trans.push({ name: `v${p.screw.trans.length + 1}`, v: [1, 0, 0] }))}
                  >
                    + поступательное
                  </button>
                </div>
                {S.trans.map((t, i) => (
                  <div className="vb-item" key={'t' + i}>
                    <div className="sp-row sp-row2">
                      <input
                        id={`sp-tn${i}`}
                        className="lg-name"
                        value={t.name}
                        spellCheck={false}
                        aria-label={`Поступательное ${i + 1}`}
                        onChange={(e) => store.type(`tn${i}`, (p) => (p.screw.trans[i].name = e.target.value.slice(0, 12)))}
                        onBlur={end(`tn${i}`)}
                      />
                      <span className="vb-tag">скорость</span>
                      <button type="button" className="del" aria-label={`Убрать ${t.name}`} onClick={() => store.act((p) => p.screw.trans.splice(i, 1))}>
                        ×
                      </button>
                    </div>
                    {v3(`tv${i}`, 'v', t.v, (p, k, x) => (p.screw.trans[i].v[k] = x))}
                  </div>
                ))}
                <div className="sub">Центр приведения O и точки</div>
                {v3('O', 'O', S.O, (p, k, x) => (p.screw.O[k] = x))}
                {pointsTable('s', S.points, (p) => p.screw.points, 'spaddspt')}
              </>
            )}

            {s.mode === 'gyro' && (
              <>
                {sel(
                  'spjmode',
                  'Момент инерции ротора',
                  G.jMode,
                  [
                    ['J', 'задан J'],
                    ['Prho', 'по весу и радиусу инерции: J = Pρ²/g'],
                    ['disc', 'сплошной диск: J = Pr²/(2g)'],
                    ['ring', 'обод: J = Pr²/g'],
                  ],
                  gy('jMode'),
                )}
                <div className="cgpar cg0">
                  {G.jMode === 'J' ? (
                    N('J', 'J', G.J, gy('J'), 'pos')
                  ) : (
                    <>
                      {N('P', 'P', G.P, gy('P'), 'pos')}
                      {G.jMode === 'Prho' ? N('rho', 'ρ', G.rho, gy('rho'), 'pos') : N('r', 'r', G.r, gy('r'), 'pos')}
                      {N('g', 'g', G.g, gy('g'), 'pos')}
                    </>
                  )}
                </div>
                {sel(
                  'spspin',
                  'Собственное вращение',
                  G.spin,
                  [
                    ['rad', 'ω, рад/с'],
                    ['rpm', 'n, об/мин'],
                    ['roll', 'качение: ω = Ω·d/R'],
                  ],
                  gy('spin'),
                )}
                <div className="cgpar cg0">
                  {G.spin === 'roll' ? (
                    <>
                      {N('dRoll', 'd', G.dRoll, gy('dRoll'), 'pos')}
                      {N('Rroll', 'R', G.Rroll, gy('Rroll'), 'pos')}
                    </>
                  ) : (
                    N('w', G.spin === 'rpm' ? 'n' : 'ω', G.w, gy('w'))
                  )}
                </div>
                {sel(
                  'sptask',
                  'Что найти',
                  G.task,
                  [
                    ['forced', 'гироскопический момент и давления на опоры'],
                    ['precession', 'прецессию под действием момента силы'],
                    ['spring', 'угол рамки гиротахометра'],
                  ],
                  gy('task'),
                )}
                {(G.task !== 'precession' || G.spin === 'roll') && (
                  <>
                    {sel(
                      'spom',
                      'Прецессия оси',
                      G.omMode,
                      [
                        ['rad', 'Ω, рад/с'],
                        ['rpm', 'n, об/мин'],
                        ['deg', 'градусов в секунду'],
                        ['curve', 'движение по кривой: Ω = v/R'],
                        ['pitch', 'качка: амплитуда и период'],
                      ],
                      gy('omMode'),
                    )}
                    <div className="cgpar cg0">
                      {(G.omMode === 'rad' || G.omMode === 'rpm' || G.omMode === 'deg') &&
                        N('Om', G.omMode === 'rad' ? 'Ω' : G.omMode === 'rpm' ? 'n' : '°/с', G.Om, gy('Om'))}
                      {G.omMode === 'curve' && (
                        <>
                          {N('v', 'v', G.v, gy('v'))}
                          {N('Rc', 'R кривой', G.Rc, gy('Rc'), 'pos')}
                        </>
                      )}
                      {G.omMode === 'pitch' && (
                        <>
                          {N('amp', 'θ₀, °', G.amp, gy('amp'))}
                          {N('Tp', 'T, с', G.T, gy('T'), 'pos')}
                        </>
                      )}
                      {G.task !== 'precession' && N('beta', 'β, °', G.beta, gy('beta'))}
                    </div>
                  </>
                )}
                {G.task === 'forced' && (
                  <>
                    <div className="cgpar cg0">
                      {N('l', 'l опор', G.l, gy('l'), 'nonneg')}
                      {N('N0', 'N₀ статич.', G.N0, gy('N0'))}
                    </div>
                    <label className="toggle">
                      <input type="checkbox" id="spone" checked={G.one} onChange={(e) => store.act((p) => (p.gyro.one = e.target.checked))} />
                      давление воспринимает одна опора (бегун)
                    </label>
                  </>
                )}
                {G.task === 'precession' && (
                  <div className="cgpar cg0">
                    {N('F', 'сила F (вес P)', G.F, gy('F'))}
                    {N('h', 'плечо h', G.h, gy('h'))}
                  </div>
                )}
                {G.task === 'spring' && (
                  <div className="cgpar cg0">
                    {N('c', 'c пружин', G.c, gy('c'), 'pos')}
                    {N('a', 'плечо a', G.a, gy('a'), 'pos')}
                  </div>
                )}
                <p className="empty">Единицы — любые согласованные (кГ, м, с, как в задачнике; если задана масса — g = 1).</p>
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
            <div id="spsolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Пространственное движение тела · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} role="img" aria-label="Чертёж" dangerouslySetInnerHTML={{ __html: fig.svg }} />
            <figcaption>Чертёж</figcaption>
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
