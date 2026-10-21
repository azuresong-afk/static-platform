/**
 * Описание раздела (модуля) приложения. Каждый раздел — отдельная вкладка со своим состоянием,
 * историей отмены и форматом данных в файле проекта; оболочка (Shell) даёт вкладки, работу с файлами
 * и общие клавиши.
 */
import type { ComponentType, ReactNode } from 'react';
import type { TaskEntry } from '../shared/tasks';

/** То, что оболочка вызывает у активного раздела. */
export interface ModuleStore {
  undo(): void;
  redo(): void;
  /** Содержимое файла проекта и предлагаемое имя. */
  exportProject(now?: Date): { name: string; text: string };
  /** Открыть проект из текста файла; ошибки раздел показывает сам. */
  importProject(text: string, fileName?: string): boolean;
  notify(text: string, tone?: 'ok' | 'bad'): void;
  /** Название проекта (для имени PDF). */
  projectTitle(): string;
}

/** Общие части страницы, которые раздел размещает у себя: вкладки и кнопки файлов. */
export interface Chrome {
  tabs: ReactNode;
  files: ReactNode;
  /** Перейти на вкладку другого раздела. */
  goto(id: string): void;
}

export interface StatikaModule {
  /** Идентификатор раздела; он же — поле module в файле проекта. */
  id: string;
  /** Подпись вкладки. */
  tab: string;
  store: ModuleStore;
  /** Разделы, чьи файлы этот раздел открывает у себя (например, «Изгиб» — файлы «Балок и рам»). */
  accepts?: string[];
  /** Экран раздела. Отчёт для печати раздел тоже рисует сам. */
  Screen: ComponentType<{ chrome: Chrome }>;
  /** Готовые задачи раздела (для «Задачника»): ключ и название; источник — в начале названия. */
  tasks?: TaskEntry[];
  /** Загрузить готовую задачу по ключу (как выбор в списке «Готовая задача»). */
  loadTask?: (key: string) => void;
}

/** Раздел из дорожной карты, который ещё не готов: его файл не открывается, а объясняется почему. */
export interface PlannedModule {
  id: string;
  tab: string;
}
