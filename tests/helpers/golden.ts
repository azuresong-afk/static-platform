import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { analyze } from '../../src/core';
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
  sel?: string | null;
  svg: Record<'construct' | 'schema', { viewBox: string; html: string }>;
}

const load = (name: string) => {
  const buf = readFileSync(fileURLToPath(new URL(`../golden/${name}`, import.meta.url)));
  return JSON.parse((name.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8'));
};

export const goldenPresets: Record<string, GoldenCase> = load('presets.json');
export const goldenRandom: GoldenCase[] = load('random.json.gz');

/**
 * Приводит HTML к сравнимому виду: прототип собирает разметку шаблонными строками с переносами
 * между блоками, а браузер сериализует её обратно. Пробелы между тегами на отображение не влияют.
 */
export const normHTML = (h: string): string => h.replace(/>\s+</g, '><').trim();

/** SVG из строки порта — к виду, в котором браузер сериализует innerHTML (<line/> → <line></line>). */
export const normSVG = (h: string): string => normHTML(h.replace(/<([a-zA-Z]+)([^<>]*?)\/>/g, '<$1$2></$1>'));

export type Mode = 'strict' | 'rank' | 'split' | 'cancel';

/** Какое намеренное отличие от прототипа затрагивает этот случай. */
export function modeOf(s: Structure, g: GoldenCase): Mode {
  const { model } = analyze(s);
  const split = model.dists.filter((d) => d.split);
  if (split.some((d) => Math.abs(d.q1 + d.q2) < 1e-12)) return 'cancel';
  if (g.status === 'indeterminate' && (g.rank ?? 3) < 3) return 'rank';
  if (split.length) return 'split';
  return 'strict';
}

