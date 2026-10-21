/** Что получает файл проверок из scripts/e2e/ (см. scripts/e2e/README.md). */
import type { Page } from 'playwright-core';

export interface E2EKit {
  p: Page;
  /** Записать проверку: ✓ или ✗ в вывод, провал — в итог прогона. */
  check: (ok: boolean, name: string, detail?: string) => void;
  /** Перейти в раздел по идентификатору модуля (сначала его блок). */
  tab: (id: string) => Promise<void>;
  /** Открыть файл проекта кнопкой «Открыть»; tone — ожидаемое уведомление. Возвращает его текст. */
  openText: (fileName: string, body: string, tone: 'ok' | 'bad') => Promise<string>;
  /** Сохранить проект активного раздела кнопкой «Сохранить» и вернуть текст файла. */
  saveText: () => Promise<string>;
  /** Отчёт для печати активного раздела: текст и число чертежей. */
  report: () => Promise<{ text: string; svgs: number }>;
  /** Снимок страницы в папку E2E_OUT, если она задана. */
  shot: (name: string) => Promise<void>;
}
