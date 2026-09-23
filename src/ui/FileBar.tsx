/** Открыть и сохранить проект (JSON), экспорт решения в PDF через печать. */
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useStore } from './useStore';

export interface FileBarHandle {
  open(): void;
  save(): void;
  print(): void;
}

/** Скачать текст как файл. */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Прочитать файл и открыть как проект. */
export async function openFile(file: File, importProject: (text: string, name?: string) => boolean) {
  const text = await file.text();
  importProject(text, file.name);
}

export const FileBar = forwardRef<FileBarHandle>(function FileBar(_, ref) {
  const [st, store] = useStore();
  const input = useRef<HTMLInputElement>(null);
  const api: FileBarHandle = {
    open: () => input.current?.click(),
    save: () => {
      const { name, text } = store.exportProject();
      download(name, text);
      store.notify(`Проект сохранён в файл «${name}».`, 'ok');
    },
    print: () => {
      // Имя PDF в диалоге печати берётся из заголовка страницы.
      const prev = document.title;
      document.title = `${st.title} — решение`;
      window.addEventListener('afterprint', () => (document.title = prev), { once: true });
      window.print();
    },
  };
  useImperativeHandle(ref, () => api);
  return (
    <div className="filebar">
      <button type="button" id="fopen" title="Открыть проект (Ctrl+O)" onClick={api.open}>
        Открыть
      </button>
      <button type="button" id="fsave" title="Сохранить проект в файл (Ctrl+S)" onClick={api.save}>
        Сохранить
      </button>
      <button type="button" id="fpdf" title="Отчёт с решением: печать или сохранение в PDF (Ctrl+P)" onClick={api.print}>
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
          if (f) void openFile(f, store.importProject);
        }}
      />
    </div>
  );
});

export function Notice() {
  const [st, store] = useStore();
  if (!st.notice) return null;
  return (
    <div className={`notice ${st.notice.tone === 'bad' ? 'n-bad' : 'n-ok'}`} role={st.notice.tone === 'bad' ? 'alert' : 'status'} key={st.notice.seq}>
      <span>{st.notice.text}</span>
      <button type="button" className="del" aria-label="Закрыть уведомление" onClick={store.closeNotice}>
        ×
      </button>
    </div>
  );
}
