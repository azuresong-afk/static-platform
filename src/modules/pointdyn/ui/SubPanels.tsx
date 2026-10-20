/** Поля данных режимов пункта 21: равновесие при вращении, поверхности и кривые, составные задачи, теорема об импульсе. */
import type { ReactNode } from 'react';
import { Num } from '../../../shared/ui/Num';
import type { ImpulseProblem } from '../model/impulse';
import type { SpinProblem } from '../model/spin';
import type { StageProblem } from '../model/stages';
import type { SurfProblem } from '../model/surf';
import type { ImpNumKey, PointStore, SpinNumKey, StageNumKey, SubMode, SurfNumKey } from './store';

type NumKeyOf = { spin: SpinNumKey; surf: SurfNumKey; stages: StageNumKey; impulse: ImpNumKey };
function useNum<M extends SubMode>(store: PointStore, mode: M, data: Record<string, unknown>) {
  return (k: NumKeyOf[M], label: string, neg = false) => (
    <Num
      key={k}
      id={`p${mode}-${k}`}
      label={label}
      value={data[k] as number}
      neg={neg}
      zero
      onType={(v) => store.typeSub(mode, k, v)}
      onEnd={() => store.endSession(`${mode}:${k}`)}
    />
  );
}
function Pick<T extends string>({
  id,
  label,
  value,
  options,
  onPick,
}: {
  id: string;
  label: string;
  value: T;
  options: [T, string][];
  onPick: (v: T) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select id={id} value={value} onChange={(e) => onPick(e.target.value as T)}>
        {options.map(([k, t]) => (
          <option key={k} value={k}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}
const Row = ({ children }: { children: ReactNode }) => <div className="cgpar cg0">{children}</div>;
const Hint = ({ children }: { children: ReactNode }) => <p className="empty">{children}</p>;

export function SpinPanel({ store, p }: { store: PointStore; p: SpinProblem }) {
  const N = useNum(store, 'spin', p as unknown as Record<string, unknown>);
  const fu = p.byWeight ? 'кГ' : 'Н';
  const finds: Record<SpinProblem['ask'], [string, string][]> = {
    bank: [
      ['angle', 'наклон без бокового усилия (по R и v)'],
      ['speed', 'пределы скорости на вираже с трением'],
      ['radius', 'радиус по показанию весов в вагоне'],
    ],
    cone: [
      ['theta', 'по углу нити — скорость и натяжение'],
      ['omega', 'по угловой скорости — угол нити'],
      ['radius', 'по радиусу окружности — v₀ сферического маятника'],
    ],
    vert: [
      ['N', 'натяжение (давление) внизу и вверху по скорости'],
      ['break', 'наименьшая ω, при которой рвётся нить'],
      ['top', 'ω, при которой исчезает давление вверху'],
    ],
    spring: [
      ['r', 'расстояние груза от оси'],
      ['c', 'жёсткость пружины'],
      ['c2', 'жёсткость по двум состояниям'],
      ['omega', 'угловая скорость'],
    ],
    rods: [
      ['phi', 'угол отклонения по ω'],
      ['omega', 'ω по углу отклонения'],
    ],
    tube: [['y', 'форма трубки']],
  };
  return (
    <>
      <Pick
        id="psask"
        label="Задача"
        value={p.ask}
        options={[
          ['bank', 'вираж, возвышение рельса, наклон велосипедиста'],
          ['cone', 'конический (сферический) маятник'],
          ['vert', 'равномерно по вертикальной окружности'],
          ['spring', 'груз на пружине во вращающейся направляющей'],
          ['rods', 'стержни на шарнире вала (тахометр)'],
          ['tube', 'трубка, в которой шарик в равновесии'],
        ]}
        onPick={(ask) => store.setSub('spin', { ask })}
      />
      {p.ask !== 'tube' && <Pick id="psfind" label="Найти" value={p.find} options={finds[p.ask]} onPick={(find) => store.setSub('spin', { find })} />}
      <Row>
        {N('m', p.byWeight ? 'вес P' : 'масса m')}
        {N('g', 'g, м/с²')}
      </Row>
      {p.ask === 'bank' && (
        <Row>
          {p.find !== 'radius' && N('R', 'радиус R, м')}
          {N('v', 'скорость v, м/с')}
          {p.find === 'angle' && N('d', 'колея d, м')}
          {p.find === 'speed' && N('alpha', 'уклон α, °')}
          {p.find === 'speed' && N('f', 'трение f')}
          {p.find === 'radius' && N('k', 'весы: k = N/P')}
        </Row>
      )}
      {p.ask === 'cone' && (
        <Row>
          {N('l', 'нить l, м')}
          {p.find === 'theta' && N('theta', 'угол θ, °')}
          {p.find === 'omega' && N('omega', 'ω, рад/с')}
          {p.find === 'radius' && N('r', 'радиус r, м')}
        </Row>
      )}
      {p.ask === 'vert' && (
        <Row>
          {N('R', 'радиус R, м')}
          {p.find === 'N' && N('v', 'скорость v, м/с')}
          {p.find === 'break' && N('T', `разрыв T, ${fu}`)}
          {p.find === 'top' && N('D', 'колесо D, м (0 — нет)')}
        </Row>
      )}
      {p.ask === 'spring' && (
        <Row>
          {N('rs', 'r_s, м (без напряжения)')}
          {p.find !== 'omega' && N('omega', p.find === 'c2' ? 'ω₁, рад/с' : 'ω, рад/с')}
          {p.find !== 'r' && N('r', p.find === 'c2' ? 'r₁, м' : 'r, м')}
          {(p.find === 'r' || p.find === 'omega') && N('c', `c, ${fu}/м`)}
          {p.find === 'c2' && N('w2', 'ω₂, рад/с')}
          {p.find === 'c2' && N('r2', 'r₂, м')}
        </Row>
      )}
      {p.ask === 'rods' && (
        <Row>
          {N('a', 'плечо a, м')}
          {N('b', 'плечо b, м')}
          {N('gamma', 'угол между ними γ, °')}
          {p.find === 'phi' ? N('omega', 'ω, рад/с') : N('phi', 'угол φ, °', true)}
        </Row>
      )}
      {p.ask === 'tube' && (
        <Row>
          {N('omega', 'ω, рад/с')}
          {N('x1', 'x, м', true)}
        </Row>
      )}
      <Hint>
        {p.ask === 'rods'
          ? 'Плечо a образует угол φ с вертикалью вниз, плечо b — угол φ − γ (по другую сторону вала при γ = 90°); γ = 180° — прямой стержень через шарнир; b = 0 — один стержень. Масса m распределена по длине a + b.'
          : p.ask === 'spring'
            ? 'Пружина тянет груз к оси с силой c(r − r_s); r_s — радиус, при котором она не напряжена (меньше рабочего — пружина с предварительным натягом).'
            : 'Точка движется по окружности равномерно; к силам добавлена центробежная сила инерции.'}
      </Hint>
    </>
  );
}

export function SurfPanel({ store, p }: { store: PointStore; p: SurfProblem }) {
  const N = useNum(store, 'surf', p as unknown as Record<string, unknown>);
  return (
    <>
      <Pick
        id="puask"
        label="Задача"
        value={p.ask}
        options={[
          ['cyl', 'внутри гладкого вертикального цилиндра'],
          ['cone', 'гладкий конус, отталкивание от вершины'],
          ['rough', 'шероховатая окружность (цилиндр)'],
          ['wire', 'нить маятника встречает проволоку'],
          ['chain', 'цепная линия, сила kmy'],
          ['helix', 'шероховатая винтовая поверхность'],
          ['alt', 'маятник на высоте'],
        ]}
        onPick={(ask) => store.setSub('surf', { ask })}
      />
      <Row>
        {N('m', p.byWeight ? 'вес P' : 'масса m')}
        {N('g', 'g, м/с²')}
      </Row>
      {p.ask === 'cyl' && (
        <Row>
          {N('r', 'радиус r, м')}
          {N('v0', 'v₀, м/с')}
          {N('alpha', 'угол v₀ с горизонтом (вниз «+»), °', true)}
          {N('t1', 't, с')}
        </Row>
      )}
      {p.ask === 'cone' && (
        <>
          <Row>
            {N('alpha', 'полуугол α, °')}
            {N('a', 'OA, м')}
            {N('v0', 'v₀, м/с')}
            {N('c', 'отталкивание c, Н/м', true)}
            {N('t1', 't, с')}
          </Row>
          <label className="toggle">
            <input type="checkbox" id="pugrav" checked={p.grav} onChange={(e) => store.setSub('surf', { grav: e.target.checked })} />
            Учитывать силу тяжести (ось конуса — вверх)
          </label>
        </>
      )}
      {p.ask === 'rough' && (
        <>
          <Pick
            id="puside"
            label="Где"
            value={p.side}
            options={[
              ['outer', 'снаружи, от верхней точки'],
              ['inner', 'изнутри, от нижней точки'],
            ]}
            onPick={(side) => store.setSub('surf', { side })}
          />
          <Row>
            {N('r', 'радиус R, м')}
            {N('f', 'трение f')}
            {N('v0', 'v₀, м/с')}
          </Row>
        </>
      )}
      {p.ask === 'wire' && (
        <Row>
          {N('l', 'нить l, м')}
          {N('alpha', 'начальный угол α, °')}
          {N('h', 'OO₁ = h, м')}
          {N('beta', 'угол β проволоки, °', true)}
        </Row>
      )}
      {p.ask === 'chain' && (
        <Row>
          {N('a', 'a, м')}
          {N('k', 'k, с⁻²')}
          {N('x0', 'x₀, м', true)}
          {N('v0', 'ẋ₀, м/с', true)}
          {N('t1', 't, с')}
        </Row>
      )}
      {p.ask === 'helix' && (
        <Row>
          {N('a', 'шаг a (z = aφ), м')}
          {N('r', 'r₀, м')}
          {N('p', 'f′(r₀)')}
          {N('k', 'трение k (0 — найти)')}
        </Row>
      )}
      {p.ask === 'alt' && (
        <Row>
          {N('H', 'высота H, м')}
          {N('Re', 'радиус Земли R, м')}
        </Row>
      )}
      <Hint>
        {p.ask === 'wire'
          ? 'Груз отпущен без скорости при угле α; проволока O₁ — на расстоянии h от точки подвеса O, под углом β к вертикали по другую сторону.'
          : p.ask === 'rough'
            ? 'Тело малых размеров; коэффициенты трения покоя и скольжения одинаковы.'
            : 'Связь идеальная (гладкая), если не задано трение.'}
      </Hint>
    </>
  );
}

export function StagesPanel({ store, p }: { store: PointStore; p: StageProblem }) {
  const N = useNum(store, 'stages', p as unknown as Record<string, unknown>);
  return (
    <>
      <Pick
        id="pgask"
        label="Задача"
        value={p.ask}
        options={[
          ['loop', 'разомкнутая петля — полёт по параболе'],
          ['jump', 'трамплин: спуск с трением и полёт'],
          ['plate', 'падение на плиту с пружиной'],
          ['fly', 'осколок маховика'],
          ['slack', 'маятник: ослабление нити и полёт'],
        ]}
        onPick={(ask) => store.setSub('stages', { ask })}
      />
      <Row>
        {N('m', p.byWeight ? 'вес P' : 'масса m')}
        {N('g', 'g, м/с²')}
      </Row>
      {p.ask === 'loop' && (
        <Row>
          {N('r', 'радиус r, м')}
          {N('alpha', 'разрыв α, °')}
          {N('h', 'проверить h, м (0 — нет)')}
        </Row>
      )}
      {p.ask === 'jump' && (
        <Row>
          {N('alpha', 'эстакада α, °')}
          {N('h', 'высота h, м')}
          {N('f', 'трение f')}
          {N('vy', 'толчок vᵧ, м/с', true)}
          {N('beta', 'приземление β, °')}
        </Row>
      )}
      {p.ask === 'plate' && (
        <Row>
          {N('H', 'высота H, м')}
          {N('h', 'сжатие h, м')}
        </Row>
      )}
      {p.ask === 'fly' && (
        <Row>
          {N('s', 'дальность s, м')}
          {N('r', 'радиус R, м')}
        </Row>
      )}
      {p.ask === 'slack' && (
        <Row>
          {N('r', 'нить l, м')}
          {N('phi0', 'φ₀ от нижней точки, °', true)}
          {N('v0', 'v₀, м/с («+» — рост φ)', true)}
        </Row>
      )}
    </>
  );
}

export function ImpulsePanel({ store, p }: { store: PointStore; p: ImpulseProblem }) {
  const N = useNum(store, 'impulse', p as unknown as Record<string, unknown>);
  const fu = p.byWeight ? 'кГ' : 'Н';
  return (
    <>
      <Pick
        id="piask"
        label="Задача"
        value={p.ask}
        options={[
          ['line', 'прямолинейное движение, постоянные силы'],
          ['vec', 'импульс равнодействующей по двум скоростям'],
          ['circle', 'импульс при движении по окружности'],
          ['area', 'нить втягивается в трубку (закон площадей)'],
          ['hole', 'нить втягивается в отверстие с постоянной скоростью'],
          ['sync', 'два маятника — общий период'],
        ]}
        onPick={(ask) => store.setSub('impulse', { ask })}
      />
      {p.ask === 'line' && (
        <Pick
          id="pifind"
          label="Найти"
          value={p.find}
          options={[
            ['t', 'время'],
            ['tpath', 'время по пути'],
            ['v1', 'конечную скорость'],
            ['F', 'силу тяги (давление)'],
            ['f', 'коэффициент трения'],
            ['m', 'массу (вес)'],
          ]}
          onPick={(find) => store.setSub('impulse', { find })}
        />
      )}
      <Row>
        {!(p.ask === 'line' && p.find === 'm') && N('m', p.byWeight ? 'вес P' : 'масса m')}
        {N('g', 'g, м/с²')}
      </Row>
      {p.ask === 'line' && (
        <Row>
          {N('v0', 'v₀, м/с')}
          {p.find !== 'v1' && p.find !== 'tpath' && N('v1', 'v₁, м/с')}
          {p.find !== 't' && p.find !== 'tpath' && N('t', 't, с')}
          {p.find === 'tpath' && N('s', 'путь s, м')}
          {p.find !== 'F' && N('F', `тяга F, ${fu}`)}
          {p.find !== 'f' && N('f', 'трение f')}
          {N('alpha', 'уклон α, ° (подъём «+»)', true)}
          {p.find === 'F' && N('A', 'площадь A (0 — нет)')}
        </Row>
      )}
      {p.ask === 'vec' && (
        <Row>
          {N('v0', 'v₀, м/с')}
          {N('a0', 'угол v₀, °', true)}
          {N('v1', 'v₁, м/с')}
          {N('a1', 'угол v₁, °', true)}
          {N('dt', 'Δt, с (0 — нет)')}
        </Row>
      )}
      {p.ask === 'circle' && (
        <Row>
          {N('v', 'скорость v, м/с')}
          {N('T', 'период T, с')}
          {N('psi', 'поворот ψ, °')}
        </Row>
      )}
      {p.ask === 'area' && (
        <Row>
          {N('r1', 'r₁, м')}
          {N('n1', 'n₁, об/мин')}
          {N('r2', 'r₂, м')}
        </Row>
      )}
      {p.ask === 'hole' && (
        <Row>
          {N('R', 'R, м')}
          {N('u0', 'поперечная u₀, м/с')}
          {N('a', 'втягивание a, м/с')}
          {N('t', 't, с')}
        </Row>
      )}
      {p.ask === 'sync' && (
        <Row>
          {N('l1', 'l₁, м')}
          {N('l2', 'l₂, м')}
        </Row>
      )}
      <Hint>
        {p.ask === 'line'
          ? 'Движение в одну сторону: сила тяги — по скорости, сопротивление R = mg(f cos α + sin α) — против неё; α > 0 — подъём, α < 0 — спуск.'
          : 'Углы — от оси x против часовой стрелки.'}
      </Hint>
    </>
  );
}
