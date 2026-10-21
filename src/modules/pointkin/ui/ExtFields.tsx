/** Поля режимов «путь», «интегрирование», «колебания», «бросок», «кулачок», «тороидальные координаты». */
import { LawField } from '../../../shared/ui/LawField';
import { Num } from '../../../shared/ui/Num';
import { camPrep } from '../model/cam';
import { COMP_FIELDS, COMP_KINDS, compDefaults, compKind } from '../model/comp';
import type { KinProblem } from '../model/kin';
import type { KinNumKey, KinStore, KinStrKey } from './store';

type Props = { pr: KinProblem; store: KinStore };

const P = (pr: KinProblem, k: string) => pr.p?.[k] ?? '';

function Pick({ id, label, value, items, onChange }: { id: string; label: string; value: string; items: [string, string][]; onChange: (v: string) => void }) {
  return (
    <label className="field" style={{ gridColumn: '1 / -1' }}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {items.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ExtFields({ pr, store }: Props) {
  const L = (k: KinStrKey, label: string) => (
    <LawField key={k} id={`k-${k}`} label={label} value={pr[k] ?? ''} onType={(s) => store.typeStr(k, s)} onEnd={() => store.endSession(`s:${k}`)} />
  );
  const N = (k: KinNumKey, label: string) => (
    <Num key={k} id={`k-${k}`} label={label} value={pr[k]} neg zero onType={(v) => store.typeNum(k, v)} onEnd={() => store.endSession(`n:${k}`)} />
  );
  /** Числовой параметр или формула без t (поле p.k). */
  const Q = (k: string, label: string, wide = false, vars?: string[], prep?: (s: string) => string) => (
    <LawField
      key={k}
      id={`kp-${k}`}
      label={label}
      wide={wide}
      value={P(pr, k)}
      vars={vars}
      prep={prep}
      onType={(s) => store.typeP(k, s)}
      onEnd={() => store.endSession(`p:${k}`)}
    />
  );
  const m = pr.mode;
  if (m === 'tor')
    return (
      <>
        <div className="cgpar cg0">
          {L('r', 'r(t) — расстояние от окружности радиуса a (оси тора)')}
          {L('phi', 'долгота ψ(t), рад')}
          {L('th', 'угол в сечении φ(t), рад')}
          {Q('a', 'a — радиус оси тора (расстояние от оси z до центра сечения)')}
          {N('t', 'момент t')}
          {N('t1', 'траектория: от t₁')}
          {N('t2', 'до t₂')}
        </div>
        <p className="empty">
          x = (a + r cos φ) cos ψ, y = (a + r cos φ) sin ψ, z = r sin φ. Орты: e_r — от оси тора к точке, e_ψ — в сторону роста долготы, e_φ — в сторону роста
          угла сечения.
        </p>
      </>
    );
  if (m === 'path') {
    const s = P(pr, 'src') === 's';
    return (
      <>
        <Pick
          id="kp-src"
          label="Закон задан"
          value={s ? 's' : 'xyz'}
          items={[
            ['xyz', 'уравнениями движения x(t), y(t), z(t)'],
            ['s', 'законом движения по траектории s(t)'],
          ]}
          onChange={(v) => store.setP('src', v)}
        />
        <div className="cgpar cg0">
          {s ? L('s', 's(t) — расстояние от начала отсчёта по траектории') : [L('x', 'x(t)'), L('y', 'y(t)'), L('z', 'z(t) — пусто, если движение плоское')]}
          {N('t1', 'от t₁')}
          {N('t2', 'до t₂')}
          {Q('n', 'число положений на чертеже и в таблице')}
        </div>
        <p className="empty">σ — путь (длина дуги), s — расстояние от начала отсчёта. Моменты остановки со сменой знака ṡ разбивают путь на участки.</p>
      </>
    );
  }
  if (m === 'integ') {
    const v = P(pr, 'src') === 'v';
    return (
      <>
        <Pick
          id="kp-src"
          label="Задано"
          value={v ? 'v' : 'a'}
          items={[
            ['a', 'ускорение a(t) — найти скорость и закон движения'],
            ['v', 'скорость v(t) — найти ускорение и закон движения'],
          ]}
          onChange={(x) => store.setP('src', x)}
        />
        <div className="cgpar cg0">
          {Q('f', v ? 'v(t)' : 'a(t)', true)}
          {Q('t0', 'начальный момент t₀')}
          {Q('x0', 'x при t₀')}
          {!v && Q('v0', 'v при t₀')}
          {N('t', 'момент t')}
        </div>
        <p className="empty">Интегрируются суммы степеней t, sin, cos и exp (в том числе их произведения); иначе — численно.</p>
      </>
    );
  }
  if (m === 'harm') {
    const par = P(pr, 'src') === 'par';
    const xv = P(pr, 'src') === 'xv';
    return (
      <>
        <Pick
          id="kp-src"
          label="Что задано"
          value={par ? 'par' : xv ? 'xv' : 'law'}
          items={[
            ['law', 'закон движения x(t) — найти параметры колебания'],
            ['par', 'период, фаза и начальное положение — найти амплитуду'],
            ['xv', 'скорости при двух положениях — найти амплитуду и частоту'],
          ]}
          onChange={(x) => store.setP('src', x)}
        />
        <div className="cgpar cg0">
          {xv
            ? [Q('x1', 'положение x₁'), Q('v1', 'скорость v₁ в x₁'), Q('x2', 'положение x₂'), Q('v2', 'скорость v₂ в x₂'), Q('a0', 'центр колебаний a₀')]
            : par
              ? [Q('T', 'период T, с'), Q('eps', 'начальная фаза ε, рад'), Q('x0', 'начальное положение x₀'), Q('a0', 'центр колебаний a₀')]
              : L('x', 'x(t)')}
          {N('t1', 'график: от t₁')}
          {N('t2', 'до t₂ (если t₂ ≤ t₁ — два периода)')}
        </div>
        <p className="empty">
          x = a₀ + a·sin(kt + ε), a &gt; 0, k &gt; 0, −π &lt; ε ≤ π. Подойдёт и сумма колебаний одной частоты: «2cos(πt + π/2) + 3cos(πt + π)».
        </p>
      </>
    );
  }
  if (m === 'comp') {
    const kind = compKind(pr);
    return (
      <>
        <Pick id="kp-kind" label="Задача" value={kind} items={COMP_KINDS} onChange={(x) => store.setPs(compDefaults(x as typeof kind))} />
        <div className="cgpar cg0">
          {COMP_FIELDS[kind].map(([k, label]) => Q(k, label, kind === 'when'))}
          {(kind === 'drops' || kind === 'pow') && N('t', 'момент t')}
          {kind === 'when' && [N('t1', 'искать от t₁'), N('t2', 'до t₂ (если t₂ ≤ t₁ — от 0 до 10)')]}
        </div>
        <p className="empty">Единицы — любые согласованные: если путь в метрах, а время в минутах, ответ получится в м/мин и м/мин².</p>
      </>
    );
  }
  if (m === 'conv') {
    const sys = P(pr, 'sys') === 'polar' ? 'polar' : P(pr, 'sys') === 'sph' ? 'sph' : 'cyl';
    return (
      <>
        <Pick
          id="kp-sys"
          label="Перейти к координатам"
          value={sys}
          items={[
            ['polar', 'полярным: r, φ (плоское движение)'],
            ['cyl', 'цилиндрическим: r, φ, z'],
            ['sph', 'сферическим: r, φ (долгота), θ (широта)'],
          ]}
          onChange={(x) => store.setP('sys', x)}
        />
        <div className="cgpar cg0">
          {L('x', 'x(t)')}
          {L('y', 'y(t)')}
          {sys !== 'polar' && L('z', 'z(t)')}
          {Q('rb', 'r(t) по книге — для сверки (пусто — не сверять)', true)}
          {Q('pb', 'φ(t) по книге', true)}
          {sys !== 'polar' && Q('zb', sys === 'sph' ? 'θ(t) по книге' : 'z(t) по книге', true)}
          {N('t', 'момент t')}
          {N('t1', 'таблица и графики: от t₁')}
          {N('t2', 'до t₂ (если t₂ ≤ t₁ — от 0 до max(t, 1))')}
        </div>
        <p className="empty">Приложение пересчитывает координаты и сверяет с формулами, найденными вами (или книгой): наибольшее отклонение по промежутку.</p>
      </>
    );
  }
  if (m === 'shot')
    return (
      <>
        <div className="cgpar cg0">
          {Q('v0', 'начальная скорость v₀')}
          {Q('al', 'угол бросания α, °')}
          {Q('g', 'g')}
          {Q('h0', 'начальная высота h₀')}
          {Q('xt', 'цель: x (пусто — не искать)')}
          {Q('yt', 'цель: y')}
        </div>
        <p className="empty">Единицы — любые согласованные (м и м/с, g = 9,81). Если задана цель, находятся углы бросания, при которых снаряд в неё попадёт.</p>
      </>
    );
  if (m === 'cam') {
    const trans = P(pr, 'kind') === 'trans';
    const law = P(pr, 'in') !== 'profile';
    return (
      <>
        <Pick
          id="kp-kind"
          label="Кулак"
          value={trans ? 'trans' : 'rot'}
          items={[
            ['rot', 'вращается равномерно, толкатель — вдоль радиуса'],
            ['trans', 'круговой, движется поступательно, толкатель вертикален'],
          ]}
          onChange={(x) => store.setP('kind', x)}
        />
        {trans ? (
          <div className="cgpar cg0">
            {Q('r', 'радиус кулака r')}
            {Q('u0', 'начальный сдвиг центра u₀')}
            {Q('vc', 'скорость кулака v')}
            <Pick
              id="kp-find"
              label="Найти"
              value={P(pr, 'find') === 'w' ? 'w' : 'h'}
              items={[
                ['h', 'опускание толкателя (ускорение кулака известно)'],
                ['w', 'ускорение кулака (опускание известно)'],
              ]}
              onChange={(x) => store.setP('find', x)}
            />
            {P(pr, 'find') === 'w' ? Q('hg', 'опускание h за время t') : Q('wc', 'ускорение кулака w')}
            {N('t', 'время t')}
          </div>
        ) : (
          <>
            <Pick
              id="kp-in"
              label="Задан"
              value={law ? 'law' : 'profile'}
              items={[
                ['law', 'закон движения толкателя x(t) за оборот — найти контур'],
                ['profile', 'контур r(φ) — найти закон движения'],
              ]}
              onChange={(x) => store.setP('in', x)}
            />
            <div className="cgpar cg0">
              {law ? Q('T', 'время одного оборота T, с') : Q('rpm', 'число оборотов в минуту')}
              {N('t', 'момент t')}
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="cvrow cvrow2" style={{ gridColumn: '1 / -1' }}>
                  {Q(`a${i}`, `участок ${i}: от (${law ? 'с' : 'рад'})`)}
                  {Q(`b${i}`, 'до')}
                  {Q(`f${i}`, law ? 'x(t) — расстояние конца толкателя от оси' : 'r(φ) — пишите φ или phi', true, undefined, law ? undefined : camPrep)}
                </div>
              ))}
            </div>
            <p className="empty">
              Участки идут подряд и покрывают оборот; лишние оставьте пустыми (формула пуста — участок не используется). Углы — в радианах (π, 2π/3).
            </p>
          </>
        )}
      </>
    );
  }
  return null;
}
