/** Поле формулы от t: ошибка разбора подсвечивается, неверная формула не применяется. */
import { useState } from 'react';
import { parseExpr } from '../expr';

export function LawField({ id, label, value, onType, onEnd, wide = true }: { id: string; label: string; wide?: boolean; value: string; onType: (s: string) => void; onEnd: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? value;
  const r = parseExpr(shown);
  return (
    <label className="sfield" style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <span>{label}</span>
      <span className="inp">
        <input
          id={id}
          type="text"
          spellCheck={false}
          className={r.ok ? undefined : 'bad'}
          title={r.ok ? undefined : r.error}
          value={shown}
          placeholder="пусто — 0"
          onChange={(e) => {
            setText(e.target.value);
            if (parseExpr(e.target.value).ok) onType(e.target.value);
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
