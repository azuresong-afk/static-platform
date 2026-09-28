/** Кнопки «Открыть», «Сохранить», «Решение в PDF» — общие для всех разделов. */
import { useRef } from 'react';

/** Скачать текст как файл. */
export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface FileActions {
  /** Файл выбран или перетащен на страницу. */
  openFile(file: File): void;
  save(): void;
  print(): void;
}

/** Панель файлов; register получает функцию, открывающую диалог выбора файла (для Ctrl+O). */
export function FileBar({ actions, register }: { actions: FileActions; register: (open: () => void) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const open = () => input.current?.click();
  register(open);
  return (
    <div className="filebar">
      <button type="button" id="fopen" title="Открыть проект (Ctrl+O)" onClick={open}>
        Открыть
      </button>
      <button type="button" id="fsave" title="Сохранить проект в файл (Ctrl+S)" onClick={actions.save}>
        Сохранить
      </button>
      <button type="button" id="fpdf" title="Отчёт с решением: печать или сохранение в PDF (Ctrl+P)" onClick={actions.print}>
        Решение в PDF
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) actions.openFile(f);
        }}
      />
    </div>
  );
}
