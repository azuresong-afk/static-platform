/**
 * Числовое поле как в прототипе: запятая или точка, «−»; некорректный ввод подсвечивается и не применяется.
 * Пока поле в фокусе, его текст не перезаписывается. Без фокуса поле показывает значение из состояния
 * и сбрасывает подсветку при любом изменении конструкции — как прототип, перерисовывающий списки.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { fmtIn, parseNum } from '../model/format';
import { useStore } from './useStore';

interface Props {
  value: number | undefined;
  /** Вызывается с разобранным числом; false — значение не принято (поле подсвечивается). */
  onValue: (v: number) => boolean | void;
  onBlur?: () => void;
  unit?: string;
  disabled?: boolean;
  label?: string;
  className?: string;
  /** Дополнительные data-атрибуты поля. */
  data?: Record<string, string>;
}

export function NumField({ value, onValue, onBlur, unit, disabled, label, className, data }: Props) {
  const [st] = useStore();
  const [text, setText] = useState(fmtIn(value));
  const [bad, setBad] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  // До отрисовки, чтобы поле никогда не показывало устаревшее значение.
  useLayoutEffect(() => {
    if (document.activeElement !== ref.current) {
      setText(fmtIn(value));
      setBad(false);
    }
  }, [value, st.s]);
  const input = (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      className={[className, bad ? 'bad' : ''].filter(Boolean).join(' ') || undefined}
      value={text}
      disabled={disabled}
      aria-label={label}
      {...data}
      onBlur={() => onBlur?.()}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseNum(e.target.value);
        if (isNaN(v)) {
          setBad(true);
          return;
        }
        setBad(onValue(v) === false);
      }}
    />
  );
  if (unit === undefined) return input;
  return (
    <div className="inp">
      {input}
      <em>{unit}</em>
    </div>
  );
}
