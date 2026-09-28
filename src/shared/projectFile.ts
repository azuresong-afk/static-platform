/**
 * Общий «конверт» файла проекта для всех модулей.
 *
 * Версия 2:
 * { "format": "statika-project", "version": 2, "module": "frames",
 *   "title": "…", "savedAt": "2026-09-28T12:00:00.000Z", …данные модуля… }
 * Данные модуля лежат рядом с полями конверта; их проверяет сам модуль.
 * В версии 1 поля module нет — такие файлы относятся к модулю «Балки и рамы» (frames).
 */

export const PROJECT_FORMAT = 'statika-project';
export const PROJECT_VERSION = 2;
/** Модуль файлов версии 1. */
export const LEGACY_MODULE = 'frames';

export type Envelope = { ok: true; module: string; title?: string; savedAt?: string; raw: Record<string, unknown> } | { ok: false; errors: string[] };

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Разобрать JSON и проверить конверт: формат, версию, модуль. */
export function readEnvelope(text: string): Envelope {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Файл не является JSON: возможно, он повреждён или это не файл проекта.'] };
  }
  if (!isObj(raw) || raw.format !== PROJECT_FORMAT)
    return { ok: false, errors: ['Это не файл проекта «Статика» (нет отметки format: "statika-project").'] };
  if (!isNum(raw.version) || raw.version > PROJECT_VERSION)
    return { ok: false, errors: [`Версия файла (${String(raw.version)}) новее, чем поддерживает приложение (${PROJECT_VERSION}). Обновите приложение.`] };
  let module = LEGACY_MODULE;
  if (raw.version >= 2) {
    if (!isStr(raw.module)) return { ok: false, errors: ['В файле не указано, к какому разделу он относится (поле module).'] };
    module = raw.module;
  }
  return { ok: true, module, title: isStr(raw.title) ? raw.title : undefined, savedAt: isStr(raw.savedAt) ? raw.savedAt : undefined, raw };
}

/** Текст файла: конверт и данные модуля. */
export function writeEnvelope(module: string, title: string, data: Record<string, unknown>, now = new Date()): string {
  const file = { format: PROJECT_FORMAT, version: PROJECT_VERSION, module, title, savedAt: now.toISOString(), ...data };
  return JSON.stringify(file, null, 2) + '\n';
}

/** Имя файла: «Своя схема 2026-09-23.statika.json» без недопустимых символов. */
export function projectFileName(title: string, date = new Date()): string {
  const safe = title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Проект';
  return `${safe} ${date.toISOString().slice(0, 10)}.statika.json`;
}
