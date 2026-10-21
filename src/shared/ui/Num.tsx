/** Числовое поле: запятая или точка; некорректное значение подсвечивается и не применяется. */
import { useState, type ReactNode } from 'react';
import { fmtIn, parseNum } from '../format';

export function Num({ id, label, unit, value, onType, onEnd, zero = false, neg = false }: { id: string; label: ReactNode; unit?: string; value: number; onType: (v: number) => void; onEnd: () => void; zero?: boolean; /** Допускаются любые числа, в том числе отрицательные. */ neg?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? fmtIn(value);
  const valid = (x: number) => Number.isFinite(x) && (neg || x > 0 || (zero && x === 0));
  const bad = !valid(parseNum(shown));
  return (
    <label className="sfield">
      <span>{label}</span>
      <span className="inp">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          className={bad ? 'bad' : undefined}
          value={shown}
          onChange={(e) => {
            setText(e.target.value);
            const x = parseNum(e.target.value);
            if (valid(x)) onType(x);
          }}
          onBlur={() => {
            setText(null);
            onEnd();
          }}
        />
        {unit && <em>{unit}</em>}
      </span>
    </label>
  );
}

