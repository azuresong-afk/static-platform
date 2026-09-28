/** Пошаговый мастер для пустого шаблона: Участки → Опоры → Нагрузки → Что найти → Решение. */
import { useEffect } from 'react';
import type { Model } from '../solver/model';
import type { Solution } from '../solver/solve';
import { STATUS } from '../text/labels';
import { WSTEPS } from './store';
import { useStore } from './useStore';

const NAMES = ['Участки', 'Опоры', 'Нагрузки', 'Что найти', 'Решение'];

function Hint({ model, sol, step }: { model: Model; sol: Solution; step: number }) {
  if (step === 1)
    return (
      <>
        <b>Шаг 1.</b> Соберите конструкцию из участков: задайте длины и направления. Чтобы получилась рама, добавьте участок вверх или вниз из нужной точки. Длину можно менять щелчком по размеру на
        чертеже. Точки между участками — места для опор и нагрузок.
      </>
    );
  if (step === 2) {
    const cls = ({ ok: 's-ok', indeterminate: 's-warn' } as Record<string, string>)[sol.status] || 's-bad';
    return (
      <>
        <b>Шаг 2.</b> Поставьте опоры и выберите для каждой точку.{' '}
        {model.supports.length ? (
          <>
            Сейчас неизвестных реакций: {model.unknowns.length}, система <span className={cls}>{STATUS[sol.status][0]}</span>.
          </>
        ) : (
          'Пока нет ни одной опоры.'
        )}
      </>
    );
  }
  if (step === 3)
    return (
      <>
        <b>Шаг 3.</b> Добавьте нагрузки: силы, грузы, моменты, распределённую нагрузку. Если силу или момент нужно найти, отметьте это в карточке нагрузки.
      </>
    );
  if (step === 4)
    return (
      <>
        <b>Шаг 4.</b> Отметьте величины, которые нужно найти. Остальные тоже посчитаются, но в ответе будут отмечены как промежуточные.
      </>
    );
  return (
    <>
      <b>Шаг 5.</b> Решение составлено. Можно вернуться к любому шагу — всё пересчитается сразу.
    </>
  );
}

export function Wizard({ model, sol }: { model: Model; sol: Solution }) {
  const [st, store] = useStore();
  const step = st.wiz.step;
  // Скрытие карточек по шагу — тем же правилом CSS, что в прототипе (body[data-wstep]).
  useEffect(() => {
    document.body.dataset.wstep = st.wiz.on ? String(step) : '';
  }, [st.wiz.on, step]);
  useEffect(() => {
    if (st.wiz.on && step === 5) document.getElementById('solution')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [st.wiz.on, step]);
  if (!st.wiz.on) return null;
  return (
    <nav className="wiz" id="wiz" aria-label="Пошаговая сборка">
      <ol className="wsteps">
        {NAMES.map((n, i) => {
          const k = i + 1;
          return (
            <li key={k}>
              <button type="button" data-wgo={k} aria-current={k === step ? 'step' : undefined} className={k < step ? 'done' : undefined} onClick={() => store.setStep(k)}>
                <span className="wn">{k}</span>
                {n}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="wbody">
        <p id="wizhint">
          <Hint model={model} sol={sol} step={step} />
        </p>
        <div className="wbtns">
          <button type="button" id="wprev" disabled={step === 1} onClick={() => store.setStep(step - 1)}>
            Назад
          </button>
          <button type="button" id="wnext" className="primary" hidden={step === WSTEPS} onClick={() => store.setStep(step + 1)}>
            {step === 4 ? 'Показать решение' : 'Далее'}
          </button>
          <button type="button" id="wexit" className="link" onClick={store.stopWiz}>
            Полный редактор
          </button>
        </div>
      </div>
    </nav>
  );
}
