import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Structure } from '../../src/model/types';

export interface GoldenCase {
  seed?: number;
  input: (Structure & { notTarget: string[] }) | null;
  html: string;
  status: string;
  n: number;
  rank: number | null;
  vals: Record<string, number>;
  steps: [string, string][];
  joint: { eqs: string[]; keys: string[] } | null;
  check: { e: string; r: number } | null;
  cands: { id: string; coeffs: Record<string, number>; cst: number }[];
  titles: Record<string, string>;
  total: string;
  normItems: Record<string, unknown>[];
  remove?: { seg: string; ok: boolean; msg: string; result: Structure | null };
  split?: { seg: string; t: number; ok: boolean; result: Structure | null };
}

const load = (name: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../golden/${name}`, import.meta.url)), 'utf8'));

export const goldenPresets: Record<string, GoldenCase> = load('presets.json');
export const goldenRandom: GoldenCase[] = load('random.json');

/**
 * Приводит HTML к сравнимому виду: прототип собирает разметку шаблонными строками с переносами
 * между блоками, а браузер сериализует её обратно. Пробелы между тегами на отображение не влияют.
 */
export const normHTML = (h: string): string => h.replace(/>\s+</g, '><').trim();
